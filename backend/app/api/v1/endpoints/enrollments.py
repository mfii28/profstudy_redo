"""
Enrollment API endpoints.
Handles enrolling users in courses and checking enrollment status.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Course
from typing import Dict
from datetime import datetime

router = APIRouter()


@router.post("/enroll")
async def enroll_user_in_course(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enroll the current user in a course (free or paid)."""
    course_id = data.get("courseId")
    if not course_id:
        raise HTTPException(status_code=400, detail="courseId is required")

    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check not already enrolled
    enrollments = user.enrollments or []
    if any(e.get("courseId") == course_id for e in enrollments):
        return {"success": True, "message": "Already enrolled"}

    now = datetime.utcnow()
    enrollments.append({
        "courseId": course_id,
        "enrolledDate": now.isoformat(),
        "progress": 0,
        "completedLessons": [],
    })
    user.enrollments = enrollments
    user.updatedAt = now
    await db.flush()

    return {"success": True}


@router.get("/{course_id}")
async def check_enrollment(
    course_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if the current user is enrolled in a specific course."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enrollments = user.enrollments or []
    is_enrolled = any(e.get("courseId") == course_id for e in enrollments)
    enrollment = next((e for e in enrollments if e.get("courseId") == course_id), None)

    return {
        "isEnrolled": is_enrolled,
        "enrollment": enrollment,
    }


@router.get("/")
async def list_enrollments(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all enrollments for the current user."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"enrollments": user.enrollments or []}
