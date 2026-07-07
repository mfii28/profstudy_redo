"""
Achievements API endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Review, Order
from typing import Dict
from datetime import datetime

router = APIRouter()


@router.get("/{user_id}")
async def get_user_achievements(
    user_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get achievements for a user (self or admin)."""
    if current_user.get("id") != user_id and current_user.get("role") not in ("admin", "superadmin", "subadmin"):
        return {"achievements": []}

    achievements = []

    # Get user to count enrollments from JSONB
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    enrollments = user.enrollments if user and user.enrollments else {}
    enrollment_count = len(enrollments) if isinstance(enrollments, dict) else (len(enrollments) if isinstance(enrollments, list) else 0)

    # Count reviews written
    review_count_result = await db.scalar(
        select(func.count(Review.id)).where(Review.userId == user_id)
    )
    review_count = review_count_result or 0

    # Count orders/purchases
    order_count_result = await db.scalar(
        select(func.count(Order.id)).where(Order.userId == user_id)
    )
    order_count = order_count_result or 0

    # Define all possible achievements
    all_achievements = [
        {
            "id": "first_course",
            "title": "First Steps",
            "description": "Enrolled in your first course",
            "icon": "🎓",
            "condition": enrollment_count >= 1
        },
        {
            "id": "five_courses",
            "title": "Eager Learner",
            "description": "Enrolled in 5 courses",
            "icon": "📚",
            "condition": enrollment_count >= 5
        },
        {
            "id": "first_review",
            "title": "Voice Your Opinion",
            "description": "Wrote your first review",
            "icon": "✍️",
            "condition": review_count >= 1
        },
        {
            "id": "first_purchase",
            "title": "First Purchase",
            "description": "Made your first purchase",
            "icon": "🛒",
            "condition": order_count >= 1
        }
    ]

    for ach in all_achievements:
        achievements.append({
            "id": ach["id"],
            "title": ach["title"],
            "description": ach["description"],
            "icon": ach["icon"],
            "isUnlocked": ach["condition"],
            "date": datetime.utcnow().isoformat() if ach["condition"] else None,
        })

    return {"achievements": achievements}
