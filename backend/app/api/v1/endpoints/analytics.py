"""
Analytics API endpoints.
Subject mastery, funnel data, and study session tracking.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Course, Order, Review
from typing import Dict
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/subject-mastery/{user_id}")
async def get_subject_mastery(
    user_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get subject mastery data for a user (self or admin)."""
    if current_user.get("id") != user_id and current_user.get("role") not in ("admin", "superadmin", "subadmin"):
        return {"subjects": []}

    # Enrollments are stored as JSONB on the User model
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.enrollments:
        return {"subjects": []}

    enrollments = user.enrollments
    if isinstance(enrollments, dict):
        enrollment_list = list(enrollments.values())
    elif isinstance(enrollments, list):
        enrollment_list = enrollments
    else:
        enrollment_list = []

    subjects = []
    for enrollment in enrollment_list:
        course_id = enrollment.get("courseId") if isinstance(enrollment, dict) else getattr(enrollment, "courseId", None)
        if not course_id:
            continue
        course_result = await db.execute(select(Course).where(Course.id == course_id))
        course = course_result.scalar_one_or_none()
        if course and course.category:
            existing = next(
                (s for s in subjects if s["name"] == course.category), None
            )
            completed = enrollment.get("completedLessons", []) if isinstance(enrollment, dict) else getattr(enrollment, "completedLessons", []) or []
            completed_count = len(completed) if completed else 0
            if existing:
                existing["courseCount"] += 1
                existing["completedLessons"] += completed_count
            else:
                subjects.append({
                    "name": course.category,
                    "courseCount": 1,
                    "completedLessons": completed_count,
                    "mastery": 0,
                })

    for subject in subjects:
        if subject["courseCount"] > 0:
            subject["mastery"] = min(
                100, round((subject["completedLessons"] / (subject["courseCount"] * 10)) * 100)
            )

    return {"subjects": subjects}


@router.get("/funnel")
async def get_funnel_data(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get conversion funnel data."""
    total_users = await db.scalar(select(func.count(User.id)))
    student_count = await db.scalar(
        select(func.count(User.id)).where(User.role == "student")
    )
    total_orders = await db.scalar(select(func.count(Order.id)))
    # Count total enrollments across all users from JSONB
    all_users_result = await db.execute(select(User.id, User.enrollments))
    all_users = all_users_result.all()
    total_enrollments = 0
    for u in all_users:
        if u.enrollments:
            if isinstance(u.enrollments, dict):
                total_enrollments += len(u.enrollments)
            elif isinstance(u.enrollments, list):
                total_enrollments += len(u.enrollments)

    funnel = [
        {"stage": "Visitors", "count": total_users or 0},
        {"stage": "Signups", "count": student_count or 0},
        {"stage": "Enrollments", "count": total_enrollments},
        {"stage": "Payments", "count": total_orders or 0},
    ]

    return {"funnel": funnel}
