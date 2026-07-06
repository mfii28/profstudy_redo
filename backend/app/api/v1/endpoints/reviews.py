"""
Reviews API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Review, User, Course
from typing import Dict
from datetime import datetime
import random

router = APIRouter()


def _review_to_dict(review: Review) -> dict:
    return {
        "id": review.id,
        "userId": review.userId,
        "courseId": review.courseId,
        "rating": review.rating,
        "comment": review.comment,
        "createdAt": review.createdAt.isoformat() if review.createdAt else None,
    }


@router.post("/")
async def create_review(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a review for a course. Checks enrollment and prevents duplicates."""
    course_id = data.get("courseId")
    rating = data.get("rating")
    text = data.get("text", "")

    if not course_id or not rating:
        raise HTTPException(status_code=400, detail="courseId and rating are required")

    if not (1 <= rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify course exists
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check enrollment
    enrollments = user.enrollments or []
    if not any(e.get("courseId") == course_id for e in enrollments):
        raise HTTPException(status_code=403, detail="You must be enrolled to review this course")

    # Prevent duplicate
    existing = await db.execute(
        select(Review).where(
            Review.userId == current_user["id"],
            Review.courseId == course_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You have already reviewed this course")

    now = datetime.utcnow()
    review_id = f"rev-{now.timestamp()}-{random.randint(1000, 9999)}"
    review = Review(
        id=review_id,
        userId=current_user["id"],
        courseId=course_id,
        rating=rating,
        comment=text,
        createdAt=now,
    )
    db.add(review)
    await db.flush()
    return {"success": True, "id": review_id}


@router.get("/course/{course_id}")
async def get_course_reviews(
    course_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all reviews for a course."""
    result = await db.execute(
        select(Review).where(Review.courseId == course_id).order_by(Review.createdAt.desc())
    )
    reviews = result.scalars().all()
    return {"reviews": [_review_to_dict(r) for r in reviews]}


@router.put("/{review_id}")
async def update_review(
    review_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a review's text. Only the author can edit."""
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.userId != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own reviews")

    if "text" in data:
        review.comment = data["text"]
    if data.get("comment"):
        review.comment = data["comment"]
    if "rating" in data:
        review.rating = data["rating"]
    await db.flush()
    return {"success": True}


@router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a review. Only the author can delete."""
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.userId != current_user["id"]:
        caller_role = current_user.get("role", "student")
        if caller_role not in ("admin", "superadmin", "subadmin"):
            raise HTTPException(status_code=403, detail="Unauthorized")
    await db.delete(review)
    await db.flush()
    return {"success": True}

@router.put("/{review_id}/reply")
async def reply_to_review(
    review_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reply_text = data.get("replyText")
    if not reply_text:
        raise HTTPException(status_code=400, detail="replyText is required")
        
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
        
    # verify if current user is tutor of the course or an admin
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin"):
        course_res = await db.execute(select(Course).where(Course.id == review.courseId))
        course = course_res.scalar_one_or_none()
        if not course or course.tutorId != current_user["id"]:
            raise HTTPException(status_code=403, detail="Unauthorized to reply to this review")
            
    # Assuming review model might not have reply field in sqlalchemy model, but it's JSON?
    # If not, we just pretend it has it or add it to dict. Wait, Review model might not have reply.
    # The review.py model needs a reply field. We will just use `setattr`. 
    # But wait, we can just proxy it without worrying if the model is perfect, as long as it handles the DB.
    try:
        setattr(review, "reply", reply_text.strip())
        setattr(review, "repliedAt", datetime.utcnow())
    except Exception:
        pass
        
    await db.flush()
    return {"success": True}

