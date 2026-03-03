import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from datetime import datetime, timezone, timedelta

from database import engine, get_db, Base
from models import Department, Officer, Product, Order, OrderItem, Notification, EmbroideryJob, Appointment
from schemas import (
    DepartmentCreate, DepartmentOut,
    OfficerCreate, OfficerOut,
    ProductCreate, ProductOut,
    OrderCreate, OrderOut, OrderItemOut,
    DashboardStats, DepartmentRevenue, LookupResult,
    NotificationOut,
    EmbroideryJobUpdate, EmbroideryJobOut,
    AppointmentCreate, AppointmentOut,
)
from sku import generate_sku, generate_order_number


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Auto-seed if database is empty
    from seed import seed_if_empty
    db = next(get_db())
    seed_if_empty(db)
    db.close()
    yield


app = FastAPI(title="UniTrack", version="1.0.0", lifespan=lifespan)


# --- Dashboard ---
@app.get("/api/dashboard", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db)):
    total_departments = db.query(Department).count()
    total_officers = db.query(Officer).count()
    total_products = db.query(Product).count()
    total_orders = db.query(Order).count()
    pending_orders = db.query(Order).filter(Order.status.in_(["pending", "confirmed"])).count()
    total_skus = db.query(OrderItem).count()

    recent_orders_db = (
        db.query(Order).order_by(Order.created_at.desc()).limit(5).all()
    )
    recent_orders = [_order_to_out(o, db) for o in recent_orders_db]

    # Orders by status
    all_statuses = ["pending", "confirmed", "in_production", "quality_check", "shipped", "delivered"]
    orders_by_status = {}
    for s in all_statuses:
        orders_by_status[s] = db.query(Order).filter(Order.status == s).count()

    # Pending items (items in non-delivered orders)
    pending_items = 0
    non_delivered = db.query(Order).filter(Order.status != "delivered").all()
    for order in non_delivered:
        for item in order.items:
            pending_items += item.quantity

    # Revenue by department
    total_revenue = 0.0
    revenue_by_department = []
    for dept in db.query(Department).all():
        dept_revenue = 0.0
        dept_order_count = 0
        for order in db.query(Order).filter(Order.department_id == dept.id).all():
            dept_order_count += 1
            for item in order.items:
                dept_revenue += item.unit_price * item.quantity
        total_revenue += dept_revenue
        revenue_by_department.append(DepartmentRevenue(
            name=dept.name, code=dept.code,
            revenue=dept_revenue, order_count=dept_order_count,
        ))
    revenue_by_department.sort(key=lambda x: x.revenue, reverse=True)

    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0.0

    # Measurements due (stale > 6 months or missing)
    measurement_fields = ['chest', 'waist', 'hips', 'neck', 'sleeve', 'inseam', 'shoulder']
    six_months_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=180)
    all_officers = db.query(Officer).all()
    measurements_due = 0
    for officer in all_officers:
        has_measurements = any(getattr(officer, f) is not None for f in measurement_fields)
        if not has_measurements:
            measurements_due += 1
        elif not officer.measurements_updated_at:
            measurements_due += 1
        elif officer.measurements_updated_at < six_months_ago:
            measurements_due += 1

    # Low stock
    low_stock_products = db.query(Product).filter(
        Product.stock_quantity <= Product.reorder_threshold
    ).all()
    low_stock_count = len(low_stock_products)
    low_stock_items = [
        {"name": p.name, "code": p.code, "stock_quantity": p.stock_quantity, "reorder_threshold": p.reorder_threshold}
        for p in low_stock_products[:5]
    ]

    # Notification count
    notification_count = db.query(Notification).count()

    # Embroidery pending
    embroidery_pending = db.query(EmbroideryJob).filter(
        EmbroideryJob.status.in_(["pending", "in_progress"])
    ).count()

    # Today's appointments
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    appointments_today = db.query(Appointment).filter(
        Appointment.date == today_str,
        Appointment.status.in_(["scheduled", "confirmed"])
    ).count()

    return DashboardStats(
        total_departments=total_departments,
        total_officers=total_officers,
        total_products=total_products,
        total_orders=total_orders,
        pending_orders=pending_orders,
        total_skus_generated=total_skus,
        pending_items=pending_items,
        total_revenue=total_revenue,
        avg_order_value=avg_order_value,
        recent_orders=recent_orders,
        orders_by_status=orders_by_status,
        revenue_by_department=revenue_by_department,
        measurements_due=measurements_due,
        low_stock_count=low_stock_count,
        low_stock_items=low_stock_items,
        notification_count=notification_count,
        embroidery_pending=embroidery_pending,
        appointments_today=appointments_today,
    )


# --- SKU Lookup ---
@app.get("/api/lookup", response_model=list[LookupResult])
def lookup(q: str = Query("", min_length=0), db: Session = Depends(get_db)):
    """Search across SKUs, order numbers, and officer names."""
    query = q.strip()
    if not query:
        return []

    term = f"%{query}%"
    results: list[LookupResult] = []
    seen = set()

    # Search order items by SKU
    items_by_sku = (
        db.query(OrderItem)
        .filter(OrderItem.sku.ilike(term))
        .limit(50)
        .all()
    )
    for item in items_by_sku:
        if item.id not in seen:
            seen.add(item.id)
            results.append(_item_to_lookup(item))

    # Search by order number
    matching_orders = (
        db.query(Order)
        .filter(Order.order_number.ilike(term))
        .limit(20)
        .all()
    )
    for order in matching_orders:
        for item in order.items:
            if item.id not in seen:
                seen.add(item.id)
                results.append(_item_to_lookup(item))

    # Search by officer name / badge (individual fields + full name)
    matching_officers = (
        db.query(Officer)
        .filter(
            (Officer.first_name.ilike(term))
            | (Officer.last_name.ilike(term))
            | (Officer.badge_number.ilike(term))
            | ((Officer.first_name + " " + Officer.last_name).ilike(term))
        )
        .limit(20)
        .all()
    )
    seen_officers = set()
    for officer in matching_officers:
        officer_items = db.query(OrderItem).filter(OrderItem.officer_id == officer.id).all()
        if officer_items:
            for item in officer_items:
                if item.id not in seen:
                    seen.add(item.id)
                    results.append(_item_to_lookup(item))
        else:
            # Officer has no orders -- return as a profile result
            seen_officers.add(officer.id)
            results.append(_officer_to_lookup(officer))

    # Search by department name
    matching_depts = (
        db.query(Department)
        .filter(Department.name.ilike(term))
        .limit(10)
        .all()
    )
    for dept in matching_depts:
        for order in dept.orders:
            for item in order.items:
                if item.id not in seen:
                    seen.add(item.id)
                    results.append(_item_to_lookup(item))

    return results[:100]


def _item_to_lookup(item: OrderItem) -> LookupResult:
    officer = item.officer
    product = item.product
    order = item.order
    dept = order.department if order else None
    return LookupResult(
        result_type="item",
        sku=item.sku,
        order_number=order.order_number if order else "",
        order_id=order.id if order else 0,
        order_status=order.status if order else "",
        department_name=dept.name if dept else "",
        officer_name=f"{officer.first_name} {officer.last_name}" if officer else "",
        officer_id=officer.id if officer else 0,
        badge_number=officer.badge_number if officer else "",
        rank=officer.rank if officer else "",
        product_name=product.name if product else "",
        product_code=product.code if product else "",
        size=item.size,
        color=item.color,
        quantity=item.quantity,
        unit_price=item.unit_price,
        custom_notes=item.custom_notes,
        measurements={
            "chest": officer.chest,
            "waist": officer.waist,
            "hips": officer.hips,
            "neck": officer.neck,
            "sleeve": officer.sleeve,
            "inseam": officer.inseam,
            "shoulder": officer.shoulder,
        } if officer else {},
    )


def _officer_to_lookup(officer: Officer) -> LookupResult:
    dept = officer.department
    return LookupResult(
        result_type="officer",
        officer_name=f"{officer.first_name} {officer.last_name}",
        officer_id=officer.id,
        badge_number=officer.badge_number,
        rank=officer.rank,
        department_name=dept.name if dept else "",
        measurements={
            "chest": officer.chest,
            "waist": officer.waist,
            "hips": officer.hips,
            "neck": officer.neck,
            "sleeve": officer.sleeve,
            "inseam": officer.inseam,
            "shoulder": officer.shoulder,
        },
    )


# --- Departments ---
@app.get("/api/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    depts = db.query(Department).order_by(Department.name).all()
    return [_dept_to_out(d, db) for d in depts]


@app.post("/api/departments", response_model=DepartmentOut)
def create_department(data: DepartmentCreate, db: Session = Depends(get_db)):
    dept = Department(**data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return _dept_to_out(dept, db)


@app.get("/api/departments/{dept_id}", response_model=DepartmentOut)
def get_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return _dept_to_out(dept, db)


@app.put("/api/departments/{dept_id}", response_model=DepartmentOut)
def update_department(dept_id: int, data: DepartmentCreate, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for key, value in data.model_dump().items():
        setattr(dept, key, value)
    db.commit()
    db.refresh(dept)
    return _dept_to_out(dept, db)


@app.delete("/api/departments/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if db.query(Order).filter(Order.department_id == dept_id).count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete department with existing orders")
    db.query(Officer).filter(Officer.department_id == dept_id).delete()
    db.delete(dept)
    db.commit()
    return {"ok": True}


# --- Officers ---
@app.get("/api/officers", response_model=list[OfficerOut])
def list_officers(
    department_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Officer)
    if department_id:
        q = q.filter(Officer.department_id == department_id)
    officers = q.order_by(Officer.last_name).all()
    return [_officer_to_out(o) for o in officers]


@app.post("/api/officers", response_model=OfficerOut)
def create_officer(data: OfficerCreate, db: Session = Depends(get_db)):
    officer = Officer(**data.model_dump())
    measurement_fields = ['chest', 'waist', 'hips', 'neck', 'sleeve', 'inseam', 'shoulder']
    if any(getattr(officer, f) is not None for f in measurement_fields):
        officer.measurements_updated_at = datetime.now(timezone.utc)
    db.add(officer)
    db.commit()
    db.refresh(officer)
    return _officer_to_out(officer)


@app.get("/api/officers/{officer_id}", response_model=OfficerOut)
def get_officer(officer_id: int, db: Session = Depends(get_db)):
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    return _officer_to_out(officer)


@app.put("/api/officers/{officer_id}", response_model=OfficerOut)
def update_officer(officer_id: int, data: OfficerCreate, db: Session = Depends(get_db)):
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    measurement_fields = ['chest', 'waist', 'hips', 'neck', 'sleeve', 'inseam', 'shoulder']
    new_data = data.model_dump()
    has_measurement_change = any(
        new_data.get(f) is not None and new_data.get(f) != getattr(officer, f)
        for f in measurement_fields
    )
    for key, value in new_data.items():
        setattr(officer, key, value)
    if has_measurement_change:
        officer.measurements_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(officer)
    return _officer_to_out(officer)


@app.delete("/api/officers/{officer_id}")
def delete_officer(officer_id: int, db: Session = Depends(get_db)):
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    if db.query(OrderItem).filter(OrderItem.officer_id == officer_id).count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete officer with existing order items")
    db.delete(officer)
    db.commit()
    return {"ok": True}


@app.post("/api/officers/bulk", response_model=list[OfficerOut])
def bulk_create_officers(data: list[OfficerCreate], db: Session = Depends(get_db)):
    created = []
    for item in data:
        dept = db.query(Department).filter(Department.id == item.department_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail=f"Department {item.department_id} not found")
        officer = Officer(**item.model_dump())
        db.add(officer)
        db.flush()
        created.append(officer)
    db.commit()
    return [_officer_to_out(o) for o in created]


# --- Products ---
@app.get("/api/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.name).all()
    return [_product_to_out(p) for p in products]


@app.post("/api/products", response_model=ProductOut)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    product = Product(
        name=data.name,
        code=data.code,
        category=data.category,
        description=data.description,
        base_price=data.base_price,
        sizes=json.dumps(data.sizes),
        colors=json.dumps(data.colors),
        stock_quantity=data.stock_quantity,
        reorder_threshold=data.reorder_threshold,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_to_out(product)


@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.name = data.name
    product.code = data.code
    product.category = data.category
    product.description = data.description
    product.base_price = data.base_price
    product.sizes = json.dumps(data.sizes)
    product.colors = json.dumps(data.colors)
    product.stock_quantity = data.stock_quantity
    product.reorder_threshold = data.reorder_threshold
    db.commit()
    db.refresh(product)
    return _product_to_out(product)


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if db.query(OrderItem).filter(OrderItem.product_id == product_id).count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete product with existing order items")
    db.delete(product)
    db.commit()
    return {"ok": True}


@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return {"ok": True}


# --- Orders ---
@app.get("/api/orders", response_model=list[OrderOut])
def list_orders(
    status: str | None = Query(None),
    department_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    if department_id:
        q = q.filter(Order.department_id == department_id)
    orders = q.order_by(Order.created_at.desc()).all()
    return [_order_to_out(o, db) for o in orders]


@app.post("/api/orders", response_model=OrderOut)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == data.department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    order_number = generate_order_number(db, dept.code)
    order = Order(
        department_id=data.department_id,
        order_number=order_number,
        notes=data.notes,
        status="pending",
    )
    db.add(order)
    db.flush()

    for item_data in data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")

        sku = generate_sku(db, dept.code, product.code, item_data.size, item_data.color)

        item = OrderItem(
            order_id=order.id,
            officer_id=item_data.officer_id,
            product_id=item_data.product_id,
            size=item_data.size,
            color=item_data.color,
            sku=sku,
            custom_notes=item_data.custom_notes,
            quantity=item_data.quantity,
            unit_price=product.base_price,
        )
        db.add(item)
        db.flush()
        # Decrement stock
        product.stock_quantity = max(0, product.stock_quantity - item_data.quantity)

        # Create embroidery jobs if specs provided
        for spec in item_data.embroidery_specs:
            emb_job = EmbroideryJob(
                order_item_id=item.id,
                job_type=spec.job_type,
                placement=spec.placement,
                content=spec.content,
                thread_color=spec.thread_color,
                font_style=spec.font_style,
                special_instructions=spec.special_instructions,
                status="pending",
            )
            db.add(emb_job)

    db.commit()
    db.refresh(order)
    return _order_to_out(order, db)


@app.get("/api/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_to_out(order, db, include_items=True)


@app.post("/api/orders/{order_id}/duplicate", response_model=OrderOut)
def duplicate_order(order_id: int, db: Session = Depends(get_db)):
    """Duplicate an existing order as a new pending order — great for annual reorders."""
    original = db.query(Order).filter(Order.id == order_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Order not found")

    dept = db.query(Department).filter(Department.id == original.department_id).first()
    new_order_number = generate_order_number(db, dept.code)
    new_order = Order(
        department_id=original.department_id,
        order_number=new_order_number,
        notes=f"Reorder based on {original.order_number}",
        status="pending",
    )
    db.add(new_order)
    db.flush()

    for item in original.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        new_sku = generate_sku(db, dept.code, product.code, item.size, item.color)
        new_item = OrderItem(
            order_id=new_order.id,
            officer_id=item.officer_id,
            product_id=item.product_id,
            size=item.size,
            color=item.color,
            sku=new_sku,
            custom_notes=item.custom_notes,
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        db.add(new_item)

    db.commit()
    db.refresh(new_order)
    return _order_to_out(new_order, db)


@app.put("/api/orders/{order_id}/status")
def update_order_status(order_id: int, status: str = Query(...), db: Session = Depends(get_db)):
    valid = ["pending", "confirmed", "in_production", "quality_check", "shipped", "delivered"]
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status

    # Auto-generate mock notifications for key status changes
    notify_templates = {
        "confirmed": ("Order {num} Confirmed", "Your order {num} has been confirmed and is being processed."),
        "shipped": ("Order {num} Shipped", "Your order {num} has been shipped and is on its way."),
        "delivered": ("Order {num} Delivered", "Your order {num} has been delivered successfully."),
    }
    if status in notify_templates:
        dept = db.query(Department).filter(Department.id == order.department_id).first()
        if dept and dept.contact_email:
            subject, body = notify_templates[status]
            notification = Notification(
                order_id=order.id,
                type="email",
                recipient=dept.contact_email,
                subject=subject.format(num=order.order_number),
                body=body.format(num=order.order_number),
                status="sent",
                sent_at=datetime.now(timezone.utc),
            )
            db.add(notification)

    db.commit()
    return {"ok": True, "status": status}


# --- Notifications ---
@app.get("/api/notifications", response_model=list[NotificationOut])
def list_notifications(
    order_id: int | None = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db),
):
    q = db.query(Notification)
    if order_id:
        q = q.filter(Notification.order_id == order_id)
    notifications = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return [_notification_to_out(n) for n in notifications]


@app.post("/api/notifications/{notification_id}/resend")
def resend_notification(notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.status = "sent"
    notif.sent_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# --- Inventory ---
@app.get("/api/inventory")
def get_inventory(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.name).all()
    items = []
    for p in products:
        if p.stock_quantity <= 0:
            stock_status = "out_of_stock"
        elif p.stock_quantity <= p.reorder_threshold:
            stock_status = "low"
        elif p.stock_quantity <= p.reorder_threshold * 1.5:
            stock_status = "warning"
        else:
            stock_status = "good"

        suggested_reorder = 0
        if p.stock_quantity < p.reorder_threshold:
            suggested_reorder = (p.reorder_threshold * 3) - p.stock_quantity

        items.append({
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "category": p.category,
            "base_price": p.base_price,
            "stock_quantity": p.stock_quantity,
            "reorder_threshold": p.reorder_threshold,
            "stock_status": stock_status,
            "suggested_reorder": suggested_reorder,
        })
    return items


# --- Embroidery Jobs ---
@app.get("/api/embroidery", response_model=list[EmbroideryJobOut])
def list_embroidery_jobs(
    status: str | None = Query(None),
    order_id: int | None = Query(None),
    assigned_to: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(EmbroideryJob)
    if status:
        q = q.filter(EmbroideryJob.status == status)
    if order_id:
        q = q.join(OrderItem).filter(OrderItem.order_id == order_id)
    if assigned_to:
        q = q.filter(EmbroideryJob.assigned_to.ilike(f"%{assigned_to}%"))
    jobs = q.order_by(EmbroideryJob.created_at.desc()).all()
    return [_embroidery_to_out(j) for j in jobs]


@app.get("/api/embroidery/stats")
def embroidery_stats(db: Session = Depends(get_db)):
    statuses = ["pending", "in_progress", "completed", "rejected"]
    counts = {}
    for s in statuses:
        counts[s] = db.query(EmbroideryJob).filter(EmbroideryJob.status == s).count()
    counts["total"] = db.query(EmbroideryJob).count()
    return counts


@app.put("/api/embroidery/{job_id}", response_model=EmbroideryJobOut)
def update_embroidery_job(job_id: int, data: EmbroideryJobUpdate, db: Session = Depends(get_db)):
    job = db.query(EmbroideryJob).filter(EmbroideryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Embroidery job not found")
    if data.status is not None:
        valid = ["pending", "in_progress", "completed", "rejected"]
        if data.status not in valid:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")
        job.status = data.status
        if data.status == "completed":
            job.completed_at = datetime.now(timezone.utc)
        else:
            job.completed_at = None
    if data.assigned_to is not None:
        job.assigned_to = data.assigned_to
    if data.special_instructions is not None:
        job.special_instructions = data.special_instructions
    db.commit()
    db.refresh(job)
    return _embroidery_to_out(job)


# --- Appointments ---
@app.get("/api/appointments", response_model=list[AppointmentOut])
def list_appointments(
    date: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Appointment)
    if date:
        q = q.filter(Appointment.date == date)
    if date_from:
        q = q.filter(Appointment.date >= date_from)
    if date_to:
        q = q.filter(Appointment.date <= date_to)
    if status:
        q = q.filter(Appointment.status == status)
    appts = q.order_by(Appointment.date, Appointment.time_start).all()
    return [_appointment_to_out(a) for a in appts]


@app.get("/api/appointments/today", response_model=list[AppointmentOut])
def today_appointments(db: Session = Depends(get_db)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    appts = (
        db.query(Appointment)
        .filter(Appointment.date == today)
        .order_by(Appointment.time_start)
        .all()
    )
    return [_appointment_to_out(a) for a in appts]


@app.post("/api/appointments", response_model=AppointmentOut)
def create_appointment(data: AppointmentCreate, db: Session = Depends(get_db)):
    appt = Appointment(**data.model_dump())
    if data.officer_id and not data.customer_name:
        officer = db.query(Officer).filter(Officer.id == data.officer_id).first()
        if officer:
            appt.customer_name = f"{officer.first_name} {officer.last_name}"
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return _appointment_to_out(appt)


@app.put("/api/appointments/{appt_id}", response_model=AppointmentOut)
def update_appointment(appt_id: int, data: AppointmentCreate, db: Session = Depends(get_db)):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    for key, value in data.model_dump().items():
        setattr(appt, key, value)
    db.commit()
    db.refresh(appt)
    return _appointment_to_out(appt)


@app.delete("/api/appointments/{appt_id}")
def delete_appointment(appt_id: int, db: Session = Depends(get_db)):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    db.delete(appt)
    db.commit()
    return {"ok": True}


# --- Helpers ---
def _dept_to_out(d: Department, db: Session) -> DepartmentOut:
    return DepartmentOut(
        id=d.id,
        name=d.name,
        code=d.code,
        service_type=d.service_type or "Law Enforcement",
        contact_name=d.contact_name,
        contact_email=d.contact_email,
        contact_phone=d.contact_phone,
        address=d.address,
        created_at=d.created_at,
        personnel_count=db.query(Officer).filter(Officer.department_id == d.id).count(),
        order_count=db.query(Order).filter(Order.department_id == d.id).count(),
    )


def _officer_to_out(o: Officer) -> OfficerOut:
    return OfficerOut(
        id=o.id,
        department_id=o.department_id,
        first_name=o.first_name,
        last_name=o.last_name,
        badge_number=o.badge_number,
        rank=o.rank,
        chest=o.chest,
        waist=o.waist,
        hips=o.hips,
        neck=o.neck,
        sleeve=o.sleeve,
        inseam=o.inseam,
        shoulder=o.shoulder,
        notes=o.notes,
        created_at=o.created_at,
        measurements_updated_at=o.measurements_updated_at,
        department_name=o.department.name if o.department else "",
    )


def _product_to_out(p: Product) -> ProductOut:
    return ProductOut(
        id=p.id,
        name=p.name,
        code=p.code,
        category=p.category,
        description=p.description,
        base_price=p.base_price,
        sizes=json.loads(p.sizes) if p.sizes else [],
        colors=json.loads(p.colors) if p.colors else [],
        stock_quantity=p.stock_quantity,
        reorder_threshold=p.reorder_threshold,
        created_at=p.created_at,
    )


def _order_to_out(o: Order, db: Session, include_items: bool = False) -> OrderOut:
    items_out = []
    total_value = 0.0
    item_count = 0
    for item in o.items:
        item_count += item.quantity
        total_value += item.unit_price * item.quantity
        if include_items:
            officer_m = {}
            if item.officer:
                officer_m = {
                    "chest": item.officer.chest,
                    "waist": item.officer.waist,
                    "hips": item.officer.hips,
                    "neck": item.officer.neck,
                    "sleeve": item.officer.sleeve,
                    "inseam": item.officer.inseam,
                    "shoulder": item.officer.shoulder,
                }
            items_out.append(OrderItemOut(
                id=item.id,
                officer_id=item.officer_id,
                product_id=item.product_id,
                size=item.size,
                color=item.color,
                sku=item.sku,
                custom_notes=item.custom_notes,
                quantity=item.quantity,
                unit_price=item.unit_price,
                officer_name=f"{item.officer.first_name} {item.officer.last_name}" if item.officer else "",
                product_name=item.product.name if item.product else "",
                officer_measurements=officer_m,
            ))

    return OrderOut(
        id=o.id,
        department_id=o.department_id,
        order_number=o.order_number,
        status=o.status,
        notes=o.notes,
        created_at=o.created_at,
        updated_at=o.updated_at,
        department_name=o.department.name if o.department else "",
        item_count=item_count,
        total_value=total_value,
        items=items_out if include_items else [],
    )


def _notification_to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        order_id=n.order_id,
        officer_id=n.officer_id,
        type=n.type,
        recipient=n.recipient,
        subject=n.subject,
        body=n.body,
        status=n.status,
        created_at=n.created_at,
        sent_at=n.sent_at,
        order_number=n.order.order_number if n.order else "",
    )


def _embroidery_to_out(j: EmbroideryJob) -> EmbroideryJobOut:
    item = j.order_item
    order = item.order if item else None
    officer = item.officer if item else None
    product = item.product if item else None
    return EmbroideryJobOut(
        id=j.id,
        order_item_id=j.order_item_id,
        job_type=j.job_type,
        placement=j.placement,
        content=j.content,
        thread_color=j.thread_color,
        font_style=j.font_style,
        special_instructions=j.special_instructions,
        status=j.status,
        assigned_to=j.assigned_to,
        created_at=j.created_at,
        completed_at=j.completed_at,
        order_number=order.order_number if order else "",
        officer_name=f"{officer.first_name} {officer.last_name}" if officer else "",
        product_name=product.name if product else "",
        sku=item.sku if item else "",
    )


def _appointment_to_out(a: Appointment) -> AppointmentOut:
    officer_name = ""
    if a.officer:
        officer_name = f"{a.officer.first_name} {a.officer.last_name}"
    elif a.customer_name:
        officer_name = a.customer_name
    return AppointmentOut(
        id=a.id,
        officer_id=a.officer_id,
        department_id=a.department_id,
        appointment_type=a.appointment_type,
        date=a.date,
        time_start=a.time_start,
        time_end=a.time_end,
        customer_name=a.customer_name,
        customer_phone=a.customer_phone,
        status=a.status,
        notes=a.notes,
        created_at=a.created_at,
        officer_name=officer_name,
        department_name=a.department.name if a.department else "",
    )


# Serve frontend
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def serve_index():
    return FileResponse("static/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
