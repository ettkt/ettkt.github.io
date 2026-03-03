from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    service_type = Column(String, default="Law Enforcement")  # Law Enforcement, Fire/EMS, Corrections, Security, Other
    contact_name = Column(String, default="")
    contact_email = Column(String, default="")
    contact_phone = Column(String, default="")
    address = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    officers = relationship("Officer", back_populates="department")
    orders = relationship("Order", back_populates="department")


class Officer(Base):
    __tablename__ = "officers"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    badge_number = Column(String, nullable=False)
    rank = Column(String, default="")
    # Measurements (inches)
    chest = Column(Float, nullable=True)
    waist = Column(Float, nullable=True)
    hips = Column(Float, nullable=True)
    neck = Column(Float, nullable=True)
    sleeve = Column(Float, nullable=True)
    inseam = Column(Float, nullable=True)
    shoulder = Column(Float, nullable=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    measurements_updated_at = Column(DateTime, nullable=True)

    department = relationship("Department", back_populates="officers")
    order_items = relationship("OrderItem", back_populates="officer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, default="")
    base_price = Column(Float, default=0.0)
    sizes = Column(Text, default="[]")  # JSON array
    colors = Column(Text, default="[]")  # JSON array
    stock_quantity = Column(Integer, default=0)
    reorder_threshold = Column(Integer, default=10)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    order_items = relationship("OrderItem", back_populates="product")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    order_number = Column(String, unique=True, nullable=False)
    status = Column(String, default="pending")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    department = relationship("Department", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    officer_id = Column(Integer, ForeignKey("officers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    size = Column(String, nullable=False)
    color = Column(String, nullable=False)
    sku = Column(String, unique=True, nullable=False)
    custom_notes = Column(Text, default="")
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    order = relationship("Order", back_populates="items")
    officer = relationship("Officer", back_populates="order_items")
    product = relationship("Product", back_populates="order_items")
    embroidery_jobs = relationship("EmbroideryJob", back_populates="order_item", cascade="all, delete-orphan")


class EmbroideryJob(Base):
    __tablename__ = "embroidery_jobs"

    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False)
    job_type = Column(String, nullable=False)       # embroidery, screen_print, patch, name_tape
    placement = Column(String, nullable=False)       # left_chest, right_chest, back, left_sleeve, right_sleeve, collar
    content = Column(String, default="")             # text or design name
    thread_color = Column(String, default="")
    font_style = Column(String, default="")          # block, script, serif, sans_serif
    special_instructions = Column(Text, default="")
    status = Column(String, default="pending")       # pending, in_progress, completed, rejected
    assigned_to = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    order_item = relationship("OrderItem", back_populates="embroidery_jobs")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    officer_id = Column(Integer, ForeignKey("officers.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    appointment_type = Column(String, nullable=False)  # fitting, alteration, pickup, consultation
    date = Column(String, nullable=False)               # YYYY-MM-DD
    time_start = Column(String, nullable=False)          # HH:MM
    time_end = Column(String, nullable=False)            # HH:MM
    customer_name = Column(String, default="")
    customer_phone = Column(String, default="")
    status = Column(String, default="scheduled")         # scheduled, confirmed, completed, cancelled, no_show
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    officer = relationship("Officer", backref="appointments")
    department = relationship("Department", backref="appointments")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    officer_id = Column(Integer, ForeignKey("officers.id"), nullable=True)
    type = Column(String, default="email")  # "email" or "sms"
    recipient = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    body = Column(Text, default="")
    status = Column(String, default="queued")  # "queued", "sent", "failed"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    sent_at = Column(DateTime, nullable=True)

    order = relationship("Order", back_populates="notifications")
    officer = relationship("Officer")
