"""
Tutor API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import User, Course
from typing import Dict, Optional

router = APIRouter()


@router.get("/students")
async def get_tutor_students(
    course_ids: Optional[str] = None,  # comma-separated
    page_size: int = 50,
    cursor: Optional[str] = None,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get students enrolled in the tutor's courses.
    Paginated via cursor (last user ID).
    """
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin", "tutor"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    # If tutor, get their course IDs
    target_course_ids = []
    if course_ids:
        target_course_ids = [c.strip() for c in course_ids.split(",") if c.strip()]
    else:
        # Get courses for this tutor
        tutor_result = await db.execute(select(Course).where(Course.tutorId == current_user["id"]))
        courses = tutor_result.scalars().all()
        target_course_ids = [c.id for c in courses]

    # Find enrolled students
    all_users = await db.execute(select(User).order_by(User.id).limit(page_size + 1))
    users = all_users.scalars().all()

    enrolled_students = []
    for user in users:
        enrollments = user.enrollments or []
        if any(e.get("courseId") in target_course_ids for e in enrollments):
            enrolled_students.append({
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar": user.avatar,
                "lastActive": user.lastActive.isoformat() if user.lastActive else None,
            })

    # Handle cursor pagination
    if cursor:
        try:
            idx = next(i for i, s in enumerate(enrolled_students) if s["id"] == cursor)
            enrolled_students = enrolled_students[idx + 1:]
        except (StopIteration, ValueError):
            pass

    has_more = len(enrolled_students) > page_size
    return {
        "students": enrolled_students[:page_size],
        "hasMore": has_more,
        "nextCursor": enrolled_students[page_size - 1]["id"] if len(enrolled_students) >= page_size else None,
    }

from pydantic import BaseModel

class SavePayoutDetailsRequest(BaseModel):
    payoutMethod: str
    bankName: Optional[str] = None
    bankAccountName: Optional[str] = None
    accountNumber: Optional[str] = None
    momoNetwork: Optional[str] = None
    payoutPhoneNumber: Optional[str] = None

@router.patch("/payout-details")
async def save_payout_details(
    req: SavePayoutDetailsRequest,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    uid = current_user["id"]
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.role not in ["tutor", "admin", "superadmin", "subadmin"]:
        raise HTTPException(status_code=403, detail="Only tutors can update payout details")

    tutor_details = dict(user.tutorDetails) if user.tutorDetails else {}
    
    tutor_details['payoutMethod'] = req.payoutMethod
    if req.payoutMethod == 'bank':
        tutor_details['bankName'] = req.bankName.strip() if req.bankName else None
        tutor_details['bankAccountName'] = req.bankAccountName.strip() if req.bankAccountName else None
        tutor_details['accountNumber'] = req.accountNumber.strip() if req.accountNumber else None
        tutor_details['momoNetwork'] = None
        tutor_details['payoutPhoneNumber'] = None
        tutor_details['momoNumber'] = None
    else:
        tutor_details['momoNetwork'] = req.momoNetwork
        tutor_details['payoutPhoneNumber'] = req.payoutPhoneNumber.strip() if req.payoutPhoneNumber else None
        tutor_details['momoNumber'] = req.payoutPhoneNumber.strip() if req.payoutPhoneNumber else None
        tutor_details['bankName'] = None
        tutor_details['bankAccountName'] = None
        tutor_details['accountNumber'] = None

    user.tutorDetails = tutor_details
    db.add(user)
    await db.commit()
    
    return {"success": True}

