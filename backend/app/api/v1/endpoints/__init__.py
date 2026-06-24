"""
StudyMate API v1 Router — aggregates all endpoint modules.
Import this router in main.py to mount all API routes.
"""

from fastapi import APIRouter

api_v1_router = APIRouter()

# Existing endpoint groups (kept as-is)
from app.api.v1.endpoints.storage import router as storage_router
from app.api.v1.endpoints.payments import router as payments_router
from app.api.v1.endpoints.rag import router as rag_router
from app.api.v1.endpoints.ai_tutor import router as ai_tutor_router

# New endpoint groups
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.courses import router as courses_router
from app.api.v1.endpoints.cart import router as cart_router
from app.api.v1.endpoints.enrollments import router as enrollments_router
from app.api.v1.endpoints.reviews import router as reviews_router
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints.live_classes import router as live_classes_router
from app.api.v1.endpoints.enrollment_index import router as enrollment_index_router
from app.api.v1.endpoints.classrooms import router as classrooms_router
from app.api.v1.endpoints.classroom_messages import router as classroom_messages_router
from app.api.v1.endpoints.classroom_presence import router as classroom_presence_router
from app.api.v1.endpoints.ai_history import router as ai_history_router
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.books import router as books_router
from app.api.v1.endpoints.checkout import router as checkout_router
from app.api.v1.endpoints.tutor import router as tutor_router
from app.api.v1.endpoints.session import router as session_router

api_v1_router.include_router(storage_router, prefix="/storage", tags=["storage"])
api_v1_router.include_router(payments_router, prefix="/payments", tags=["payments"])
api_v1_router.include_router(rag_router, prefix="/rag", tags=["rag"])
api_v1_router.include_router(ai_tutor_router, prefix="/student", tags=["student"])
api_v1_router.include_router(users_router, prefix="/users", tags=["users"])
api_v1_router.include_router(courses_router, prefix="/courses", tags=["courses"])
api_v1_router.include_router(cart_router, prefix="/cart", tags=["cart"])
api_v1_router.include_router(enrollments_router, prefix="/enrollments", tags=["enrollments"])
api_v1_router.include_router(reviews_router, prefix="/reviews", tags=["reviews"])
api_v1_router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
api_v1_router.include_router(live_classes_router, prefix="/live-classes", tags=["live-classes"])
api_v1_router.include_router(enrollment_index_router, prefix="/enrollment-index", tags=["enrollment-index"])
api_v1_router.include_router(classrooms_router, prefix="/classrooms", tags=["classrooms"])
api_v1_router.include_router(classroom_messages_router, prefix="/classroom-messages", tags=["classroom-messages"])
api_v1_router.include_router(classroom_presence_router, prefix="/classroom-presence", tags=["classroom-presence"])
api_v1_router.include_router(ai_history_router, prefix="/ai-history", tags=["ai-history"])
api_v1_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_v1_router.include_router(books_router, prefix="/books", tags=["books"])
api_v1_router.include_router(checkout_router, prefix="/checkout", tags=["checkout"])
api_v1_router.include_router(tutor_router, prefix="/tutor", tags=["tutor"])
api_v1_router.include_router(session_router, prefix="/session", tags=["session"])
