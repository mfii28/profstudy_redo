"""
Live Classes API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import LiveClass, User, Course
from typing import Dict
from datetime import datetime
import random

router = APIRouter()


def _lc_to_dict(lc: LiveClass) -> dict:
    return {
        "id": lc.id,
        "title": lc.title,
        "instructor": lc.instructor,
        "instructorId": lc.instructorId,
        "startTime": lc.startTime.isoformat() if lc.startTime else None,
        "durationMinutes": lc.durationMinutes,
        "status": lc.status,
        "courseId": lc.courseId,
        "meetingId": lc.meetingId,
        "createdAt": lc.createdAt.isoformat() if lc.createdAt else None,
        "updatedAt": lc.updatedAt.isoformat() if lc.updatedAt else None,
    }


@router.post("/")
async def create_live_session(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a live session. Zoom URL stored securely in joinUrl field."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin", "tutor"):
        raise HTTPException(status_code=403, detail="Only tutors and admins can create live sessions")

    title = data.get("title")
    zoom_url = data.get("zoomUrl")
    start_time_str = data.get("startTime")
    duration = data.get("durationMinutes", 60)
    course_id = data.get("courseId", "").strip()

    if not title or not start_time_str:
        raise HTTPException(status_code=400, detail="title and startTime are required")

    if zoom_url:
        try:
            parsed_url = __import__("urllib.parse").urlparse(zoom_url)
            if not parsed_url.hostname or not (
                parsed_url.hostname.endswith(".zoom.us")
                or parsed_url.hostname == "zoom.us"
                or parsed_url.hostname.endswith(".zoom.com")
                or parsed_url.hostname == "zoom.com"
            ):
                raise HTTPException(status_code=400, detail="Must be a valid Zoom URL")
        except Exception:
            raise HTTPException(status_code=400, detail="Must be a valid Zoom URL")

    now = datetime.utcnow()
    session_id = f"live-{int(now.timestamp())}-{random.randint(100000, 999999)}"

    try:
        start_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
    except ValueError:
        start_time = datetime.utcnow()

    # Get caller name
    user_result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = user_result.scalar_one_or_none()
    instructor_name = user.name if user else "Instructor"

    session = LiveClass(
        id=session_id,
        title=title.strip()[:200],
        instructor=instructor_name or current_user.get("name", "Instructor"),
        instructorId=current_user["id"],
        startTime=start_time,
        durationMinutes=duration,
        status="upcoming",
        courseId=course_id if course_id else None,
        joinUrl=zoom_url,
        createdAt=now,
        updatedAt=now,
    )
    db.add(session)
    await db.flush()
    return {"id": session_id}


@router.get("/")
async def list_live_sessions(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all live sessions (with filters)."""
    caller_role = current_user.get("role", "student")
    query = select(LiveClass).order_by(LiveClass.startTime.desc())

    # Tutors see their own sessions; students see upcoming ones
    if caller_role == "tutor":
        query = query.where(LiveClass.instructorId == current_user["id"])
    elif caller_role == "student":
        query = query.where(LiveClass.status.in_(["upcoming", "live"]))

    result = await db.execute(query.limit(100))
    sessions = result.scalars().all()
    return {"sessions": [_lc_to_dict(s) for s in sessions]}


@router.put("/{session_id}")
async def update_live_session(
    session_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a live session (title, time, status, etc.)."""
    result = await db.execute(select(LiveClass).where(LiveClass.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Live session not found")

    caller_role = current_user.get("role", "student")
    is_admin = caller_role in ("admin", "superadmin", "subadmin")
    if not is_admin and session.instructorId != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if "title" in data:
        session.title = data["title"].strip()[:200]
    if "startTime" in data:
        try:
            session.startTime = datetime.fromisoformat(data["startTime"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            session.startTime = datetime.fromisoformat(data["startTime"])
    if "durationMinutes" in data:
        session.durationMinutes = data["durationMinutes"]
    if "status" in data:
        session.status = data["status"]
    if "zoomUrl" in data:
        session.joinUrl = data["zoomUrl"]
    if "courseId" in data:
        session.courseId = data["courseId"].strip() or None

    session.updatedAt = datetime.utcnow()
    await db.flush()
    return {"success": True}


@router.get("/{session_id}")
async def get_live_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get live session metadata (without join URL — use /join-url for that)."""
    result = await db.execute(select(LiveClass).where(LiveClass.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Live session not found")
    return {"session": _lc_to_dict(session)}


@router.get("/{session_id}/join-url")
async def get_join_url(
    session_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the Zoom join URL for a session.
    Permission-gated: instructor, admin, or enrolled student can access.
    """
    result = await db.execute(select(LiveClass).where(LiveClass.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Live session not found")

    if not session.joinUrl:
        raise HTTPException(status_code=404, detail="No join URL configured")

    caller_role = current_user.get("role", "student")
    is_admin = caller_role in ("admin", "superadmin", "subadmin")
    is_instructor = session.instructorId == current_user["id"]

    if is_admin or is_instructor:
        return {"url": session.joinUrl, "title": session.title}

    # Student: check enrollment
    user_result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if session.courseId:
        enrollments = user.enrollments or []
        if not any(e.get("courseId") == session.courseId for e in enrollments):
            raise HTTPException(status_code=403, detail="You are not enrolled in this course")

    return {"url": session.joinUrl, "title": session.title}


@router.delete("/{session_id}")
async def delete_live_session(
    session_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a live session. Only instructor or admin can delete."""
    result = await db.execute(select(LiveClass).where(LiveClass.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Live session not found")

    caller_role = current_user.get("role", "student")
    is_admin = caller_role in ("admin", "superadmin", "subadmin")

    if not is_admin and session.instructorId != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    await db.delete(session)
    await db.flush()
    return {"success": True}
