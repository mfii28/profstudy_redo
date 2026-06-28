"""
Checkout API endpoints.
Validates cart contents and initiates Paystack payment.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import CartItem, Course, Coupon
from typing import Dict
from datetime import datetime

router = APIRouter()


@router.post("/validate")
async def validate_cart_total(
    data: Dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Server-side cart total validation.
    Given cart items, validates current prices from DB.
    """
    items = data.get("items", [])
    total = 0.0

    for item in items:
        course_id = item.get("courseId")
        quantity = item.get("quantity", 1)
        if course_id:
            result = await db.execute(select(Course).where(Course.id == course_id))
            course = result.scalar_one_or_none()
            if course and course.price:
                total += course.price * quantity

    return {"validatedTotal": round(total, 2)}


@router.post("/validate-coupon")
async def validate_coupon(
    data: Dict,
    db: AsyncSession = Depends(get_db),
):
    """Validate a coupon code and return its discount percentage."""
    code = data.get("code", "").strip().upper()
    course_id = data.get("courseId")
    if not code:
        raise HTTPException(status_code=400, detail="Coupon code is required.")

    result = await db.execute(select(Coupon).where(Coupon.code == code))
    coupon = result.scalar_one_or_none()

    if not coupon:
        return {"valid": False, "message": "Invalid coupon code."}

    if coupon.expiresAt and coupon.expiresAt < datetime.utcnow():
        return {"valid": False, "message": "This coupon has expired."}

    if coupon.maxUses and coupon.usedCount >= coupon.maxUses:
        return {"valid": False, "message": "This coupon has reached its usage limit."}

    if coupon.courseId and coupon.courseId != course_id:
        return {"valid": False, "message": "This coupon does not apply to this course."}

    return {
        "valid": True,
        "discountPct": coupon.discountPct,
        "code": coupon.code,
    }


@router.post("/apply-coupon")
async def apply_coupon(
    data: Dict,
    db: AsyncSession = Depends(get_db),
):
    """Apply a coupon: validate, increment usage, return discounted total."""
    code = data.get("code", "").strip().upper()
    total = data.get("total", 0)
    course_id = data.get("courseId")

    result = await db.execute(select(Coupon).where(Coupon.code == code))
    coupon = result.scalar_one_or_none()

    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon.")
    if coupon.expiresAt and coupon.expiresAt < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Coupon expired.")
    if coupon.maxUses and coupon.usedCount >= coupon.maxUses:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached.")

    # Increment usage
    coupon.usedCount += 1
    coupon.updatedAt = datetime.utcnow()

    discount = total * (coupon.discountPct / 100)
    discounted_total = round(total - discount, 2)

    await db.flush()

    return {
        "success": True,
        "originalTotal": total,
        "discount": round(discount, 2),
        "discountedTotal": discounted_total,
        "discountPct": coupon.discountPct,
    }
