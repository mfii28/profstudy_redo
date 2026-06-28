"""
SQLAlchemy ORM models matching the Prisma schema in the frontend.
These models mirror the PostgreSQL tables exactly so the Python backend
can perform all CRUD operations that currently go through the adminDb shim.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Boolean, Integer, Float, DateTime, Text, ForeignKey,
    UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="student")
    status: Mapped[str] = mapped_column(String, default="active")
    lastActive: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    studyStreak: Mapped[int] = mapped_column(Integer, default=0)
    pointsSpent: Mapped[int] = mapped_column(Integer, default=0)
    referredBy: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    passwordHash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    emailVerified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    student_registration_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    affiliate_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    isPremium: Mapped[bool] = mapped_column(Boolean, default=False)
    tutorApproved: Mapped[bool] = mapped_column(Boolean, default=False)
    aiUsage: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    enrollments: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    wishlistCourseIds: Mapped[Optional[list]] = mapped_column(ARRAY(String), default=list)
    preferences: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    phoneVerified: Mapped[bool] = mapped_column(Boolean, default=False)
    registrationVerified: Mapped[bool] = mapped_column(Boolean, default=False)
    otpHash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    otpExpiresAt: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    otpAttempts: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tutorDetails = relationship("TutorDetail", back_populates="user", uselist=False)
    cartItems = relationship("CartItem", back_populates="user")
    orders = relationship("Order", back_populates="user")
    reviews = relationship("Review", back_populates="user")
    classroomMessages = relationship("ClassroomMessage", back_populates="user")
    classroomPresence = relationship("ClassroomPresence", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    bookPurchases = relationship("BookPurchase", back_populates="user")


class Account(Base):
    __tablename__ = "Account"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String)
    provider: Mapped[str] = mapped_column(String)
    providerAccountId: Mapped[str] = mapped_column(String)
    refresh_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    expires_at: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    token_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    scope: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    id_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    session_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint("provider", "providerAccountId"),
    )


class TutorDetail(Base):
    __tablename__ = "TutorDetail"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"), unique=True)
    totalStudents: Mapped[int] = mapped_column(Integer, default=0)
    avgRating: Mapped[float] = mapped_column(Float, default=0.0)
    verificationStatus: Mapped[str] = mapped_column(String, default="pending")
    idCardUrl: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    certificationUrl: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="tutorDetails")
    courses = relationship("Course", back_populates="tutor")
    payoutRequests = relationship("PayoutRequest", back_populates="tutor")


class CartItem(Base):
    __tablename__ = "CartItem"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    courseId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    bookId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="cartItems")


class ActiveSession(Base):
    __tablename__ = "ActiveSession"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(String, unique=True)
    expiresAt: Mapped[datetime] = mapped_column(DateTime)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Course(Base):
    __tablename__ = "Course"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    isFree: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String, default="Draft")
    tutorId: Mapped[str] = mapped_column(String, ForeignKey("TutorDetail.id", ondelete="CASCADE"))
    categoryId: Mapped[Optional[str]] = mapped_column(String, ForeignKey("CourseCategory.id", ondelete="SET NULL"), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tutor = relationship("TutorDetail", back_populates="courses")
    category = relationship("CourseCategory", back_populates="courses")
    ragSources = relationship("CourseRagSource", back_populates="course")


class CourseCategory(Base):
    __tablename__ = "CourseCategory"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    courses = relationship("Course", back_populates="category")


class Order(Base):
    __tablename__ = "Order"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="pending")
    reference: Mapped[str] = mapped_column(String, unique=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="orders")


class Book(Base):
    __tablename__ = "Book"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    price: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="Draft")
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    purchases = relationship("BookPurchase", back_populates="book")


class BookPurchase(Base):
    __tablename__ = "BookPurchase"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    bookId: Mapped[str] = mapped_column(String, ForeignKey("Book.id", ondelete="CASCADE"))
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="bookPurchases")
    book = relationship("Book", back_populates="purchases")


class Review(Base):
    __tablename__ = "Review"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    courseId: Mapped[str] = mapped_column(String)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reviews")


class LiveClass(Base):
    __tablename__ = "LiveClass"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    instructor: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    instructorId: Mapped[str] = mapped_column(String)
    startTime: Mapped[datetime] = mapped_column(DateTime)
    durationMinutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, default="upcoming")
    courseId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    meetingId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    joinUrl: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Classroom(Base):
    __tablename__ = "Classroom"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    tutorId: Mapped[str] = mapped_column(String)
    enrolledStudentIds: Mapped[Optional[list]] = mapped_column(ARRAY(String), default=list)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ClassroomMessage(Base):
    __tablename__ = "ClassroomMessage"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    classroomId: Mapped[str] = mapped_column(String, ForeignKey("Classroom.id", ondelete="CASCADE"))
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="classroomMessages")


class ClassroomPresence(Base):
    __tablename__ = "ClassroomPresence"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    classroomId: Mapped[str] = mapped_column(String, ForeignKey("Classroom.id", ondelete="CASCADE"))
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String, default="online")
    lastActive: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="classroomPresence")


class PayoutRequest(Base):
    __tablename__ = "PayoutRequest"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tutorId: Mapped[str] = mapped_column(String, ForeignKey("TutorDetail.id", ondelete="CASCADE"))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="pending")
    adminNote: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reviewedBy: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reviewedAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tutor = relationship("TutorDetail", back_populates="payoutRequests")


class Achievement(Base):
    __tablename__ = "Achievement"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String)
    badgeUrl: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SupportTicket(Base):
    __tablename__ = "SupportTicket"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="open")
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    __tablename__ = "Notification"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(Text)
    isRead: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class CourseRagSource(Base):
    __tablename__ = "CourseRagSource"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    courseId: Mapped[str] = mapped_column(String, ForeignKey("Course.id", ondelete="CASCADE"))
    sourceFile: Mapped[str] = mapped_column(String)
    contentHash: Mapped[str] = mapped_column(String)
    chunkCount: Mapped[int] = mapped_column(Integer, default=1)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="ragSources")

    __table_args__ = (
        UniqueConstraint("courseId", "sourceFile"),
    )


class PlatformSettings(Base):
    __tablename__ = "platformSettings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BlogPost(Base):
    __tablename__ = "BlogPost"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    slug: Mapped[str] = mapped_column(String, unique=True)
    summary: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    coverUrl: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    authorId: Mapped[str] = mapped_column(String)
    authorName: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String)
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String), default=list)
    status: Mapped[str] = mapped_column(String, default="Draft")
    publishedAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    viewCount: Mapped[int] = mapped_column(Integer, default=0)


class Testimonial(Base):
    __tablename__ = "Testimonial"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    avatar: Mapped[str] = mapped_column(String)
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="approved")
    group: Mapped[str] = mapped_column(String, default="general")
    submittedBy: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    submittedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewedAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reviewedBy: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, default="admin")
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DiscussionThread(Base):
    __tablename__ = "DiscussionThread"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    authorId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("DiscussionMessage", back_populates="thread")


class DiscussionMessage(Base):
    __tablename__ = "DiscussionMessage"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    threadId: Mapped[str] = mapped_column(String, ForeignKey("DiscussionThread.id", ondelete="CASCADE"))
    authorId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    thread = relationship("DiscussionThread", back_populates="messages")


class Coupon(Base):
    __tablename__ = "Coupon"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True)
    discountPct: Mapped[int] = mapped_column(Integer)
    maxUses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    usedCount: Mapped[int] = mapped_column(Integer, default=0)
    courseId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    expiresAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
