"""
Classrooms API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Classroom, User
from typing import Dict
from datetime import datetime
import random

router = APIRouter()


def _classroom_to_dict(c: Classroom) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "tutorId": c.tutorId,
        "enrolledStudentIds": c.enrolledStudentIds or [],
        "createdAt": c.createdAt.isoformat() if c.createdAt else None,
    }


@router.post("/{course_id}/create")
async def create_classroom(
    course_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a classroom from a course."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Check if classroom already exists
    result = await db.execute(select(Classroom).where(Classroom.id == course_id))
    existing = result.scalar_one_or_none()
    if existing:
        return {"classroom": _classroom_to_dict(existing)}

    # Look up course to get a meaningful name and tutor
    from app.models.models import Course
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()

    now = datetime.utcnow()
    classroom = Classroom(
        id=course_id,
        name=course.title if course else f"Classroom-{course_id[:8]}",
        tutorId=course.tutorId if course else current_user["id"],
        enrolledStudentIds=[],
        createdAt=now,
    )
    db.add(classroom)
    await db.flush()
    return {"classroom": _classroom_to_dict(classroom)}


@router.post("/{course_id}/sync-student")
async def sync_student_to_classroom(
    course_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a student to a classroom's enrolledStudentIds."""
    student_uid = data.get("studentUid")
    if not student_uid:
        raise HTTPException(status_code=400, detail="studentUid is required")

    result = await db.execute(select(Classroom).where(Classroom.id == course_id))
    classroom = result.scalar_one_or_none()
    if not classroom:
        # Auto-create classroom if it doesn't exist
        now = datetime.utcnow()
        classroom = Classroom(
            id=course_id,
            name=f"Classroom-{course_id[:8]}",
            tutorId="",
            enrolledStudentIds=[],
            createdAt=now,
        )
        db.add(classroom)
        await db.flush()

    current_ids = classroom.enrolledStudentIds or []
    if student_uid not in current_ids:
        classroom.enrolledStudentIds = current_ids + [student_uid]
        await db.flush()

    return {"success": True}


@router.get("/{course_id}")
async def get_classroom(
    course_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get classroom by course ID."""
    result = await db.execute(select(Classroom).where(Classroom.id == course_id))
    classroom = result.scalar_one_or_none()
    if not classroom:
        # Fallback: try finding by name or other field
        result2 = await db.execute(
            select(Classroom).where(Classroom.name.like(f"%{course_id}%")).limit(1)
        )
        classroom = result2.scalar_one_or_none()

    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return {"classroom": _classroom_to_dict(classroom)}

@router.get("/{course_id}/members")
async def get_classroom_members(
    course_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get detailed member info for a classroom."""
    result = await db.execute(select(Classroom).where(Classroom.id == course_id))
    classroom = result.scalar_one_or_none()
    if not classroom:
        return {"members": []}

    enrolled_ids = classroom.enrolledStudentIds or []
    if not enrolled_ids:
        return {"members": []}

    # Fetch user details
    users_result = await db.execute(select(User).where(User.id.in_(enrolled_ids)))
    users = users_result.scalars().all()
    
    members = []
    for u in users:
        members.append({
            "userId": u.id,
            "name": u.name,
            "role": u.role,
            "avatarUrl": u.avatarUrl,
            "classroomRole": "classroom-author" if u.role in ["tutor", "instructor"] else "classroom-student"
        })
    
    return {"members": members}


@router.post("/{course_id}/presence")
async def update_user_presence(
    course_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user presence status (online, away, dnd)."""
    status = data.get("status", "online")
    # In a full implementation, we would store this in a cache (e.g. Redis) or DB.
    # For now, return success to satisfy the frontend polling.
    return {"success": True, "status": status}


@router.get("/{course_id}/users/{user_id}")
async def get_classroom_user_profile(
    course_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific user's profile for the classroom UI."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "profile": {
            "userId": user.id,
            "name": user.name,
            "role": user.role,
            "avatarUrl": user.avatarUrl,
            "bio": user.bio
        }
    }
