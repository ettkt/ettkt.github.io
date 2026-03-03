from pydantic import BaseModel
from datetime import datetime


# --- Department ---
class DepartmentCreate(BaseModel):
    name: str
    code: str
    service_type: str = "Law Enforcement"
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    address: str = ""


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    service_type: str
    contact_name: str
    contact_email: str
    contact_phone: str
    address: str
    created_at: datetime
    personnel_count: int = 0
    order_count: int = 0

    class Config:
        from_attributes = True


# --- Officer ---
class OfficerCreate(BaseModel):
    department_id: int
    first_name: str
    last_name: str
    badge_number: str
    rank: str = ""
    chest: float | None = None
    waist: float | None = None
    hips: float | None = None
    neck: float | None = None
    sleeve: float | None = None
    inseam: float | None = None
    shoulder: float | None = None
    notes: str = ""


class OfficerOut(BaseModel):
    id: int
    department_id: int
    first_name: str
    last_name: str
    badge_number: str
    rank: str
    chest: float | None
    waist: float | None
    hips: float | None
    neck: float | None
    sleeve: float | None
    inseam: float | None
    shoulder: float | None
    notes: str
    created_at: datetime
    measurements_updated_at: datetime | None = None
    department_name: str = ""

    class Config:
        from_attributes = True


# --- Product ---
class ProductCreate(BaseModel):
    name: str
    code: str
    category: str
    description: str = ""
    base_price: float = 0.0
    sizes: list[str] = []
    colors: list[str] = []
    stock_quantity: int = 0
    reorder_threshold: int = 10


class ProductOut(BaseModel):
    id: int
    name: str
    code: str
    category: str
    description: str
    base_price: float
    sizes: list[str]
    colors: list[str]
    stock_quantity: int = 0
    reorder_threshold: int = 10
    created_at: datetime

    class Config:
        from_attributes = True


# --- Order ---
class EmbroiderySpec(BaseModel):
    job_type: str
    placement: str
    content: str = ""
    thread_color: str = ""
    font_style: str = ""
    special_instructions: str = ""


class OrderItemCreate(BaseModel):
    officer_id: int
    product_id: int
    size: str
    color: str
    custom_notes: str = ""
    quantity: int = 1
    embroidery_specs: list[EmbroiderySpec] = []


class OrderCreate(BaseModel):
    department_id: int
    notes: str = ""
    items: list[OrderItemCreate]


class OrderItemOut(BaseModel):
    id: int
    officer_id: int
    product_id: int
    size: str
    color: str
    sku: str
    custom_notes: str
    quantity: int
    unit_price: float
    officer_name: str = ""
    product_name: str = ""
    officer_measurements: dict = {}

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    department_id: int
    order_number: str
    status: str
    notes: str
    created_at: datetime
    updated_at: datetime
    department_name: str = ""
    item_count: int = 0
    total_value: float = 0.0
    items: list[OrderItemOut] = []

    class Config:
        from_attributes = True


# --- Dashboard ---
class LookupResult(BaseModel):
    result_type: str = "item"  # "item" or "officer"
    sku: str = ""
    order_number: str = ""
    order_id: int = 0
    order_status: str = ""
    department_name: str = ""
    officer_name: str = ""
    officer_id: int = 0
    badge_number: str = ""
    rank: str = ""
    product_name: str = ""
    product_code: str = ""
    size: str = ""
    color: str = ""
    quantity: int = 0
    unit_price: float = 0.0
    custom_notes: str = ""
    measurements: dict = {}


class DepartmentRevenue(BaseModel):
    name: str
    code: str
    revenue: float
    order_count: int


class DashboardStats(BaseModel):
    total_departments: int
    total_officers: int
    total_products: int
    total_orders: int
    pending_orders: int
    total_skus_generated: int
    pending_items: int
    total_revenue: float
    avg_order_value: float
    recent_orders: list[OrderOut]
    orders_by_status: dict[str, int]
    revenue_by_department: list[DepartmentRevenue]
    measurements_due: int = 0
    low_stock_count: int = 0
    low_stock_items: list[dict] = []
    notification_count: int = 0
    embroidery_pending: int = 0
    appointments_today: int = 0


# --- Embroidery Job ---
class EmbroideryJobUpdate(BaseModel):
    status: str | None = None
    assigned_to: str | None = None
    special_instructions: str | None = None


class EmbroideryJobOut(BaseModel):
    id: int
    order_item_id: int
    job_type: str
    placement: str
    content: str
    thread_color: str
    font_style: str
    special_instructions: str
    status: str
    assigned_to: str
    created_at: datetime
    completed_at: datetime | None
    order_number: str = ""
    officer_name: str = ""
    product_name: str = ""
    sku: str = ""

    class Config:
        from_attributes = True


# --- Appointment ---
class AppointmentCreate(BaseModel):
    officer_id: int | None = None
    department_id: int | None = None
    appointment_type: str
    date: str
    time_start: str
    time_end: str
    customer_name: str = ""
    customer_phone: str = ""
    status: str = "scheduled"
    notes: str = ""


class AppointmentOut(BaseModel):
    id: int
    officer_id: int | None
    department_id: int | None
    appointment_type: str
    date: str
    time_start: str
    time_end: str
    customer_name: str
    customer_phone: str
    status: str
    notes: str
    created_at: datetime
    officer_name: str = ""
    department_name: str = ""

    class Config:
        from_attributes = True


# --- Notification ---
class NotificationOut(BaseModel):
    id: int
    order_id: int
    officer_id: int | None
    type: str
    recipient: str
    subject: str
    body: str
    status: str
    created_at: datetime
    sent_at: datetime | None
    order_number: str = ""

    class Config:
        from_attributes = True
