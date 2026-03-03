import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import Department, Officer, Product, Order, OrderItem, Notification, EmbroideryJob, Appointment
from datetime import timedelta
from sku import generate_sku, generate_order_number


def seed_if_empty(db: Session):
    if db.query(Department).count() > 0:
        return

    # --- Departments ---
    mpd = Department(
        name="Metro City Police Department",
        code="MPD",
        service_type="Law Enforcement",
        contact_name="Sgt. Robert Chen",
        contact_email="r.chen@metrocitypd.gov",
        contact_phone="(555) 234-5678",
        address="100 Main St, Metro City, CA 90001",
    )
    rfd = Department(
        name="Riverside Fire Department",
        code="RFD",
        service_type="Fire/EMS",
        contact_name="Capt. Maria Santos",
        contact_email="m.santos@riversidefd.gov",
        contact_phone="(555) 876-5432",
        address="450 Oak Ave, Riverside, CA 92501",
    )
    wso = Department(
        name="Westfield Sheriff's Office",
        code="WSO",
        service_type="Law Enforcement",
        contact_name="Deputy Lisa Park",
        contact_email="l.park@westfieldso.gov",
        contact_phone="(555) 345-6789",
        address="789 County Rd, Westfield, CA 93001",
    )
    db.add_all([mpd, rfd, wso])
    db.flush()

    # --- Officers (MPD) ---
    mpd_officers = [
        Officer(department_id=mpd.id, first_name="James", last_name="Rodriguez", badge_number="MPD-1042", rank="Patrol Officer", chest=42.0, waist=34.0, neck=16.5, sleeve=34.0, inseam=32.0, shoulder=19.0, notes="Badge placement 2 inches from top seam"),
        Officer(department_id=mpd.id, first_name="Sarah", last_name="Kim", badge_number="MPD-1088", rank="Detective", chest=36.0, waist=28.0, neck=14.0, sleeve=31.0, inseam=30.0, shoulder=16.0, notes="Prefers slightly looser fit on sleeves"),
        Officer(department_id=mpd.id, first_name="Michael", last_name="Thompson", badge_number="MPD-1105", rank="Sergeant", chest=46.0, waist=38.0, neck=17.5, sleeve=35.0, inseam=33.0, shoulder=20.5, notes="Extra room in shoulders for tactical vest"),
        Officer(department_id=mpd.id, first_name="Angela", last_name="Davis", badge_number="MPD-1129", rank="Patrol Officer", chest=34.0, waist=26.0, neck=13.5, sleeve=30.0, inseam=29.0, shoulder=15.5, notes=""),
        Officer(department_id=mpd.id, first_name="Daniel", last_name="Nguyen", badge_number="MPD-1156", rank="Corporal", chest=40.0, waist=32.0, neck=16.0, sleeve=33.0, inseam=31.0, shoulder=18.0, notes="Name tape centered 1 inch above right pocket"),
    ]

    # --- Officers (RFD) ---
    rfd_officers = [
        Officer(department_id=rfd.id, first_name="Carlos", last_name="Mendoza", badge_number="RFD-301", rank="Firefighter", chest=44.0, waist=36.0, neck=17.0, sleeve=34.5, inseam=33.0, shoulder=20.0, notes="Reinforced elbows requested"),
        Officer(department_id=rfd.id, first_name="Jennifer", last_name="O'Brien", badge_number="RFD-315", rank="Lieutenant", chest=38.0, waist=30.0, neck=14.5, sleeve=32.0, inseam=31.0, shoulder=17.0, notes=""),
        Officer(department_id=rfd.id, first_name="Marcus", last_name="Williams", badge_number="RFD-322", rank="Captain", chest=48.0, waist=40.0, neck=18.0, sleeve=36.0, inseam=34.0, shoulder=21.0, notes="Custom captain insignia placement on collar"),
    ]

    # --- Officers (WSO) ---
    wso_officers = [
        Officer(department_id=wso.id, first_name="Patricia", last_name="Reyes", badge_number="WSO-205", rank="Deputy", chest=35.0, waist=27.0, neck=14.0, sleeve=31.0, inseam=30.0, shoulder=16.0, notes="Star badge 2.5 inches from seam"),
        Officer(department_id=wso.id, first_name="Thomas", last_name="Jackson", badge_number="WSO-218", rank="Senior Deputy", chest=43.0, waist=35.0, neck=16.5, sleeve=34.0, inseam=32.0, shoulder=19.5, notes=""),
    ]

    db.add_all(mpd_officers + rfd_officers + wso_officers)
    db.flush()

    # Set measurements_updated_at — some fresh, some stale for demo
    now = datetime.now(timezone.utc)
    for officer in mpd_officers[:3]:
        officer.measurements_updated_at = now - timedelta(days=60)   # 2 months ago (fresh)
    for officer in mpd_officers[3:]:
        officer.measurements_updated_at = now - timedelta(days=240)  # 8 months ago (stale)
    for officer in rfd_officers[:1]:
        officer.measurements_updated_at = now - timedelta(days=30)   # 1 month ago (fresh)
    for officer in rfd_officers[1:]:
        officer.measurements_updated_at = now - timedelta(days=200)  # ~7 months ago (stale)
    for officer in wso_officers:
        officer.measurements_updated_at = now - timedelta(days=100)  # ~3 months ago (fresh)

    # --- Products ---
    products = [
        Product(
            name="Class A Dress Shirt",
            code="CAS",
            category="Shirts",
            description="Long-sleeve dress uniform shirt with badge tab and epaulettes",
            base_price=65.00,
            sizes=json.dumps(["34R", "36R", "38R", "40R", "42R", "44R", "46R", "48R", "36L", "38L", "40L", "42L", "44L", "46L"]),
            colors=json.dumps(["Navy", "Black", "White"]),
            stock_quantity=45,
            reorder_threshold=20,
        ),
        Product(
            name="Class B Duty Shirt",
            code="CBS",
            category="Shirts",
            description="Short-sleeve duty shirt with mic clips and pen pockets",
            base_price=55.00,
            sizes=json.dumps(["S", "M", "L", "XL", "2XL", "3XL"]),
            colors=json.dumps(["Navy", "Black", "Khaki"]),
            stock_quantity=8,
            reorder_threshold=15,
        ),
        Product(
            name="Class A Dress Pants",
            code="CAP",
            category="Pants",
            description="Dress uniform trousers with satin stripe option",
            base_price=75.00,
            sizes=json.dumps(["28x30", "30x30", "30x32", "32x30", "32x32", "34x30", "34x32", "36x32", "36x34", "38x32", "38x34", "40x32", "40x34"]),
            colors=json.dumps(["Navy", "Black"]),
            stock_quantity=30,
            reorder_threshold=15,
        ),
        Product(
            name="Tactical Cargo Pants",
            code="TCP",
            category="Pants",
            description="Ripstop tactical pants with reinforced knees and cargo pockets",
            base_price=85.00,
            sizes=json.dumps(["28x30", "30x30", "30x32", "32x30", "32x32", "34x30", "34x32", "36x32", "36x34", "38x32", "38x34", "40x32"]),
            colors=json.dumps(["Navy", "Black", "Khaki", "Olive"]),
            stock_quantity=5,
            reorder_threshold=12,
        ),
        Product(
            name="Duty Jacket",
            code="DJK",
            category="Outerwear",
            description="All-weather duty jacket with removable liner and reflective trim",
            base_price=145.00,
            sizes=json.dumps(["S", "M", "L", "XL", "2XL", "3XL"]),
            colors=json.dumps(["Navy", "Black"]),
            stock_quantity=3,
            reorder_threshold=8,
        ),
        Product(
            name="Station Wear T-Shirt",
            code="SWT",
            category="Shirts",
            description="Cotton blend station wear t-shirt with department logo",
            base_price=25.00,
            sizes=json.dumps(["S", "M", "L", "XL", "2XL", "3XL"]),
            colors=json.dumps(["Navy", "Black", "Gray"]),
            stock_quantity=60,
            reorder_threshold=25,
        ),
    ]
    db.add_all(products)
    db.flush()

    # --- Sample Orders ---
    # Order 1: MPD bulk order (delivered)
    order1 = Order(
        department_id=mpd.id,
        order_number=generate_order_number(db, "MPD"),
        status="delivered",
        notes="Annual uniform refresh for patrol division",
    )
    db.add(order1)
    db.flush()

    cas = products[0]  # Class A Dress Shirt
    cap = products[2]  # Class A Dress Pants
    for officer in mpd_officers[:3]:
        shirt_size = f"{int(officer.chest)}R" if officer.chest else "42R"
        pant_size = f"{int(officer.waist)}x{int(officer.inseam)}" if officer.waist and officer.inseam else "34x32"

        sku1 = generate_sku(db, "MPD", cas.code, shirt_size, "Navy")
        item1 = OrderItem(order_id=order1.id, officer_id=officer.id, product_id=cas.id, size=shirt_size, color="Navy", sku=sku1, custom_notes=officer.notes, quantity=2, unit_price=cas.base_price)
        db.add(item1)

        sku2 = generate_sku(db, "MPD", cap.code, pant_size, "Navy")
        item2 = OrderItem(order_id=order1.id, officer_id=officer.id, product_id=cap.id, size=pant_size, color="Navy", sku=sku2, custom_notes="", quantity=2, unit_price=cap.base_price)
        db.add(item2)

    # Order 2: RFD order (in production)
    order2 = Order(
        department_id=rfd.id,
        order_number=generate_order_number(db, "RFD"),
        status="in_production",
        notes="New station wear for Engine Company 7",
    )
    db.add(order2)
    db.flush()

    swt = products[5]  # Station Wear T-Shirt
    tcp = products[3]  # Tactical Cargo Pants
    for officer in rfd_officers:
        size_map = {38: "M", 44: "L", 48: "2XL"}
        tshirt_size = size_map.get(int(officer.chest), "L") if officer.chest else "L"
        pant_size = f"{int(officer.waist)}x{int(officer.inseam)}" if officer.waist and officer.inseam else "34x32"

        sku1 = generate_sku(db, "RFD", swt.code, tshirt_size, "Navy")
        item1 = OrderItem(order_id=order2.id, officer_id=officer.id, product_id=swt.id, size=tshirt_size, color="Navy", sku=sku1, custom_notes="", quantity=3, unit_price=swt.base_price)
        db.add(item1)

        sku2 = generate_sku(db, "RFD", tcp.code, pant_size, "Black")
        item2 = OrderItem(order_id=order2.id, officer_id=officer.id, product_id=tcp.id, size=pant_size, color="Black", sku=sku2, custom_notes=officer.notes, quantity=2, unit_price=tcp.base_price)
        db.add(item2)

    # Order 3: WSO pending order
    order3 = Order(
        department_id=wso.id,
        order_number=generate_order_number(db, "WSO"),
        status="pending",
        notes="Duty jackets for winter season",
    )
    db.add(order3)
    db.flush()

    djk = products[4]  # Duty Jacket
    for officer in wso_officers:
        size_map = {35: "S", 43: "L"}
        jacket_size = size_map.get(int(officer.chest), "L") if officer.chest else "L"

        sku = generate_sku(db, "WSO", djk.code, jacket_size, "Navy")
        item = OrderItem(order_id=order3.id, officer_id=officer.id, product_id=djk.id, size=jacket_size, color="Navy", sku=sku, custom_notes=officer.notes, quantity=1, unit_price=djk.base_price)
        db.add(item)

    db.flush()

    # --- Mock Notification History ---
    notif1 = Notification(
        order_id=order1.id, type="email",
        recipient="r.chen@metrocitypd.gov",
        subject=f"Order {order1.order_number} Confirmed",
        body=f"Your order {order1.order_number} has been confirmed and is being processed.",
        status="sent", sent_at=now - timedelta(days=28),
    )
    notif2 = Notification(
        order_id=order1.id, type="email",
        recipient="r.chen@metrocitypd.gov",
        subject=f"Order {order1.order_number} Shipped",
        body=f"Your order {order1.order_number} has been shipped and is on its way.",
        status="sent", sent_at=now - timedelta(days=14),
    )
    notif3 = Notification(
        order_id=order1.id, type="email",
        recipient="r.chen@metrocitypd.gov",
        subject=f"Order {order1.order_number} Delivered",
        body=f"Your order {order1.order_number} has been delivered successfully.",
        status="sent", sent_at=now - timedelta(days=7),
    )
    notif4 = Notification(
        order_id=order2.id, type="email",
        recipient="m.santos@riversidefd.gov",
        subject=f"Order {order2.order_number} Confirmed",
        body=f"Your order {order2.order_number} has been confirmed and is being processed.",
        status="sent", sent_at=now - timedelta(days=10),
    )
    notif5 = Notification(
        order_id=order2.id, type="sms",
        recipient="(555) 876-5432",
        subject=f"Order {order2.order_number} Status Update",
        body=f"Your order {order2.order_number} is now in production.",
        status="failed",
    )
    db.add_all([notif1, notif2, notif3, notif4, notif5])
    db.flush()

    # --- Embroidery Jobs ---
    all_items = db.query(OrderItem).all()
    mpd_items = [i for i in all_items if i.order_id == order1.id]
    rfd_items = [i for i in all_items if i.order_id == order2.id]
    wso_items = [i for i in all_items if i.order_id == order3.id]

    embroidery_jobs = []

    # MPD delivered order — completed jobs
    if len(mpd_items) >= 4:
        embroidery_jobs.extend([
            EmbroideryJob(order_item_id=mpd_items[0].id, job_type="name_tape", placement="right_chest",
                content="RODRIGUEZ", thread_color="Gold", font_style="block",
                special_instructions="1 inch above pocket", status="completed",
                assigned_to="Maria", completed_at=now - timedelta(days=10)),
            EmbroideryJob(order_item_id=mpd_items[0].id, job_type="patch", placement="left_sleeve",
                content="MPD Shoulder Patch", special_instructions="Standard department patch, sew 1 inch from seam",
                status="completed", assigned_to="Maria", completed_at=now - timedelta(days=9)),
            EmbroideryJob(order_item_id=mpd_items[1].id, job_type="embroidery", placement="left_chest",
                content="Metro City PD", thread_color="Gold", font_style="script",
                status="completed", assigned_to="Tommy", completed_at=now - timedelta(days=8)),
            EmbroideryJob(order_item_id=mpd_items[2].id, job_type="name_tape", placement="right_chest",
                content="KIM", thread_color="Silver", font_style="block",
                special_instructions="Detective badge tab area", status="completed",
                assigned_to="Maria", completed_at=now - timedelta(days=12)),
        ])

    # RFD in_production order — mix of statuses
    if len(rfd_items) >= 4:
        embroidery_jobs.extend([
            EmbroideryJob(order_item_id=rfd_items[0].id, job_type="screen_print", placement="back",
                content="RIVERSIDE FIRE DEPT", font_style="block",
                special_instructions="Large print, reflective ink",
                status="in_progress", assigned_to="Tommy"),
            EmbroideryJob(order_item_id=rfd_items[0].id, job_type="embroidery", placement="left_chest",
                content="Engine Co. 7", thread_color="Red", font_style="serif",
                status="pending"),
            EmbroideryJob(order_item_id=rfd_items[1].id, job_type="name_tape", placement="right_chest",
                content="MENDOZA", thread_color="White", font_style="block",
                status="in_progress", assigned_to="Maria"),
            EmbroideryJob(order_item_id=rfd_items[2].id, job_type="patch", placement="left_sleeve",
                content="RFD Shoulder Patch",
                special_instructions="Heat-seal method for station wear",
                status="pending"),
            EmbroideryJob(order_item_id=rfd_items[3].id, job_type="screen_print", placement="back",
                content="RIVERSIDE FIRE DEPT", font_style="block",
                special_instructions="Same template as item 1",
                status="pending"),
        ])

    # WSO pending order — all pending/unassigned
    if len(wso_items) >= 2:
        embroidery_jobs.extend([
            EmbroideryJob(order_item_id=wso_items[0].id, job_type="embroidery", placement="left_chest",
                content="Westfield Sheriff", thread_color="Gold", font_style="script",
                special_instructions="Star logo above text", status="pending"),
            EmbroideryJob(order_item_id=wso_items[0].id, job_type="name_tape", placement="right_chest",
                content="REYES", thread_color="Gold", font_style="block",
                status="pending"),
            EmbroideryJob(order_item_id=wso_items[1].id, job_type="embroidery", placement="left_chest",
                content="Westfield Sheriff", thread_color="Gold", font_style="script",
                special_instructions="Star logo above text", status="pending"),
        ])

    db.add_all(embroidery_jobs)
    db.flush()

    # --- Appointments ---
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    day_after = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d")

    appointments = [
        Appointment(officer_id=mpd_officers[0].id, department_id=mpd.id, appointment_type="fitting",
            date=today, time_start="09:00", time_end="09:30",
            customer_name="James Rodriguez", customer_phone="(555) 111-2222",
            status="confirmed", notes="Annual Class A fitting, full measurements update needed"),
        Appointment(officer_id=rfd_officers[0].id, department_id=rfd.id, appointment_type="alteration",
            date=today, time_start="10:00", time_end="10:30",
            customer_name="Carlos Mendoza", customer_phone="(555) 333-4444",
            status="scheduled", notes="Take in waist on tactical pants, 1 inch"),
        Appointment(officer_id=None, department_id=None, appointment_type="consultation",
            date=today, time_start="13:00", time_end="13:45",
            customer_name="Chief David Park", customer_phone="(555) 555-6666",
            status="scheduled", notes="Walk-in - New department account discussion"),
        Appointment(officer_id=mpd_officers[1].id, department_id=mpd.id, appointment_type="pickup",
            date=today, time_start="15:00", time_end="15:15",
            customer_name="Sarah Kim", customer_phone="(555) 777-8888",
            status="scheduled", notes="Picking up completed Class A order"),
        Appointment(officer_id=wso_officers[0].id, department_id=wso.id, appointment_type="fitting",
            date=tomorrow, time_start="09:30", time_end="10:00",
            customer_name="Patricia Reyes", customer_phone="(555) 999-0000",
            status="scheduled", notes="New duty jacket fitting"),
        Appointment(officer_id=mpd_officers[2].id, department_id=mpd.id, appointment_type="fitting",
            date=tomorrow, time_start="11:00", time_end="11:45",
            customer_name="Michael Thompson", customer_phone="(555) 222-3333",
            status="scheduled", notes="Tactical vest accommodation — needs extra room in shoulders"),
        Appointment(officer_id=rfd_officers[1].id, department_id=rfd.id, appointment_type="alteration",
            date=day_after, time_start="14:00", time_end="14:30",
            customer_name="Jennifer O'Brien",
            status="scheduled", notes="Hem dress pants, sleeve length adjustment"),
        Appointment(officer_id=mpd_officers[3].id, department_id=mpd.id, appointment_type="fitting",
            date=(datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d"),
            time_start="10:00", time_end="10:30",
            customer_name="Angela Davis", status="completed",
            notes="Full measurement update completed"),
        Appointment(officer_id=rfd_officers[2].id, department_id=rfd.id, appointment_type="consultation",
            date=(datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d"),
            time_start="16:00", time_end="16:30",
            customer_name="Marcus Williams", status="no_show",
            notes="Captain insignia consultation — did not arrive"),
    ]
    db.add_all(appointments)

    db.commit()
    print("Database seeded with demo data.")
