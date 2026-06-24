"""
Checkout API endpoints.
Validates cart contents and initiates Paystack payment.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import CartItem, Course
from typing import Dict

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
