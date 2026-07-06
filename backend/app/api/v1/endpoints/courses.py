"""
Course API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Course, User
from typing import Dict
from datetime import datetime

router = APIRouter()


def _course_to_dict(course: Course) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "price": course.price,
        "isFree": course.isFree,
        "status": course.status,
        "tutorId": course.tutorId,
        "categoryId": course.categoryId,
        "createdAt": course.createdAt.isoformat() if course.createdAt else None,
        "updatedAt": course.updatedAt.isoformat() if course.updatedAt else None,
    }


@router.get("/")
async def list_courses(
    db: AsyncSession = Depends(get_db),
):
    """List all published courses."""
    result = await db.execute(
        select(Course).where(Course.status == "Published").order_by(Course.createdAt.desc())
    )
    courses = result.scalars().all()
    return {"courses": [_course_to_dict(c) for c in courses]}


@router.get("/{course_id}")
async def get_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single course by ID."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"course": _course_to_dict(course)}


@router.get("/enrolled/list")
async def get_enrolled_courses(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get courses the current user is enrolled in."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enrollments = user.enrollments or []
    course_ids = [e.get("courseId") for e in enrollments if e.get("courseId")]

    courses = []
    for cid in course_ids:
        cr = await db.execute(select(Course).where(Course.id == cid))
        c = cr.scalar_one_or_none()
        if c:
            courses.append(_course_to_dict(c))

    return {"courses": courses}

@router.post("/{course_id}/enroll")
async def enroll_free_course(
    course_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enroll the current user in a free course."""
    # Check if course is free
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if not course.isFree:
        raise HTTPException(status_code=400, detail="This course is not free")

    if course.status.lower() != "published":
        raise HTTPException(status_code=400, detail="Course is not available")

    # Get user
    user_result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enrollments = user.enrollments or {}
    if isinstance(enrollments, list):
        enrollments = {}
        
    if course_id in enrollments:
        return {"success": True, "message": "Already enrolled"}

    enrollments[course_id] = {
        "courseId": course_id,
        "enrolledDate": datetime.utcnow().isoformat(),
        "source": "self_enroll_free",
        "progress": 0,
        "completedLessons": []
    }
    
    user.enrollments = enrollments
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user, "enrollments")
    await db.flush()
    
    return {"success": True, "message": "Successfully enrolled"}
