from sqlalchemy.orm import Session
from models import OrderItem

# Color code mapping
COLOR_CODES = {
    "Navy": "NVY",
    "Black": "BLK",
    "White": "WHT",
    "Khaki": "KHK",
    "Gray": "GRY",
    "Dark Navy": "DNV",
    "Tan": "TAN",
    "Brown": "BRN",
    "Olive": "OLV",
    "Forest Green": "FGN",
}


def get_color_code(color: str) -> str:
    return COLOR_CODES.get(color, color[:3].upper())


def generate_sku(
    db: Session,
    dept_code: str,
    product_code: str,
    size: str,
    color: str,
) -> str:
    """Generate a unique SKU like MPD-CAS-42R-NVY-00001"""
    color_code = get_color_code(color)
    size_code = size.replace(" ", "").upper()
    prefix = f"{dept_code}-{product_code}-{size_code}-{color_code}"

    last_item = (
        db.query(OrderItem)
        .filter(OrderItem.sku.like(f"{prefix}-%"))
        .order_by(OrderItem.id.desc())
        .first()
    )

    if last_item:
        last_seq = int(last_item.sku.split("-")[-1])
        seq = last_seq + 1
    else:
        seq = 1

    return f"{prefix}-{seq:05d}"


def generate_order_number(db, department_code: str) -> str:
    """Generate order number like ORD-MPD-20260301-001"""
    from datetime import datetime, timezone

    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"ORD-{department_code}-{date_str}"

    from models import Order

    last_order = (
        db.query(Order)
        .filter(Order.order_number.like(f"{prefix}-%"))
        .order_by(Order.id.desc())
        .first()
    )

    if last_order:
        last_seq = int(last_order.order_number.split("-")[-1])
        seq = last_seq + 1
    else:
        seq = 1

    return f"{prefix}-{seq:03d}"
