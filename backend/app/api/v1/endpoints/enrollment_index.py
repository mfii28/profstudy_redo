"""
Enrollment Index API endpoints.
Manages the courseEnrollments/{courseId}/members/{userId} index for fast lookups.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User
from typing import Dict, Optional
from datetime import datetime

router = APIRouter()


@router.get("/{course_id}/users")
async def list_enrolled_users(
    course_id: str,
    limit: int = 500,
    start_after_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated list of user IDs enrolled in a course."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin", "tutor"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Query users whose enrollments JSON contains courseId
    all_users = await db.execute(
        select(User).order_by(User.id).limit(limit)
    )
    users = all_users.scalars().all()

    enrolled_ids = []
    for user in users:
        enrollments = user.enrollments or []
        if any(e.get("courseId") == course_id for e in enrollments):
            enrolled_ids.append(user.id)

    # Handle pagination via start_after_id
    if start_after_id:
        try:
            idx = enrolled_ids.index(start_after_id)
            enrolled_ids = enrolled_ids[idx + 1:]
        except ValueError:
            pass

    has_more = len(enrolled_ids) > limit
    return {
        "userIds": enrolled_ids[:limit],
        "hasMore": has_more,
        "nextCursor": enrolled_ids[limit - 1] if len(enrolled_ids) >= limit else None,
    }


@router.post("/{course_id}/users/{user_id}")
async def add_user_to_index(
    course_id: str,
    user_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a user to a course's enrollment index by updating their enrollments JSON."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin", "tutor"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enrollments = user.enrollments or []
    if not any(e.get("courseId") == course_id for e in enrollments):
        source = data.get("source", "admin")
        enrollments.append({
            "courseId": course_id,
            "enrolledDate": datetime.utcnow().isoformat(),
            "source": source,
            "progress": 0,
            "completedLessons": [],
        })
        user.enrollments = enrollments
        user.updatedAt = datetime.utcnow()
        await db.flush()

    return {"success": True}


@router.delete("/{course_id}/users/{user_id}")
async def remove_user_from_index(
    course_id: str,
    user_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a user from a course's enrollment index."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enrollments = user.enrollments or []
    user.enrollments = [e for e in enrollments if e.get("courseId") != course_id]
    user.updatedAt = datetime.utcnow()
    await db.flush()
    return {"success": True}


@router.post("/{course_id}/backfill")
async def backfill_enrollment_index(
    course_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Backfill enrollment index by scanning all users for courseId in enrollments."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    all_users = await db.execute(select(User))
    users = all_users.scalars().all()

    scanned = 0
    already_enrolled = 0
    added = 0
    for user in users:
        scanned += 1
        enrollments = user.enrollments or []
        if any(e.get("courseId") == course_id for e in enrollments):
            already_enrolled += 1
            continue

        # User has an Order for this course but no enrollment - fix it
        from app.models.models import Order
        order_check = await db.execute(
            select(Order).where(
                Order.userId == user.id,
                Order.reference == course_id,  # Match by course context
            )
        )
        has_order = order_check.scalar_one_or_none() is not None
        if has_order:
            enrollments.append({
                "courseId": course_id,
                "enrolledDate": datetime.utcnow().isoformat(),
                "source": "backfill",
                "progress": 0,
                "completedLessons": [],
            })
            user.enrollments = enrollments
            user.updatedAt = datetime.utcnow()
            added += 1

    if added > 0:
        await db.flush()

    return {"scannedUsers": scanned, "alreadyEnrolled": already_enrolled, "added": added}
