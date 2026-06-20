from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Table, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from app.core.database import Base
import datetime

class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True)  # Matches Firebase UID or NextAuth provider ID
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    address = Column(String, nullable=True)
    role = Column(String, default="student")
    status = Column(String, default="active")
    lastActive = Column(DateTime, nullable=True)
    studyStreak = Column(Integer, default=0)
    pointsSpent = Column(Integer, default=0)
    referredBy = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    tutorDetails = relationship("TutorDetail", uselist=False, back_populates="user", cascade="all, delete-orphan")
    cartItems = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")
    activeSessions = relationship("ActiveSession", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    discussionThreads = relationship("DiscussionThread", back_populates="author", cascade="all, delete-orphan")
    discussionMessages = relationship("DiscussionMessage", back_populates="author", cascade="all, delete-orphan")
    sentMessages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    classroomMessages = relationship("ClassroomMessage", back_populates="user", cascade="all, delete-orphan")
    classroomPresence = relationship("ClassroomPresence", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("Achievement", back_populates="user", cascade="all, delete-orphan")
    bookPurchases = relationship("BookPurchase", back_populates="user", cascade="all, delete-orphan")
    supportTickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class TutorDetail(Base):
    __tablename__ = "TutorDetail"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), unique=True, nullable=False)
    totalStudents = Column(Integer, default=0)
    avgRating = Column(Float, default=0.0)
    verificationStatus = Column(String, default="pending")
    idCardUrl = Column(String, nullable=True)
    certificationUrl = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="tutorDetails")
    courses = relationship("Course", back_populates="tutor", cascade="all, delete-orphan")
    payoutRequests = relationship("PayoutRequest", back_populates="tutor", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "CartItem"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    courseId = Column(String, nullable=True)
    bookId = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="cartItems")


class ActiveSession(Base):
    __tablename__ = "ActiveSession"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, nullable=False)
    expiresAt = Column(DateTime, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="activeSessions")


class Course(Base):
    __tablename__ = "Course"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    isFree = Column(Boolean, default=False)
    status = Column(String, default="Draft")
    tutorId = Column(String, ForeignKey("TutorDetail.id", ondelete="CASCADE"), nullable=False)
    categoryId = Column(String, ForeignKey("CourseCategory.id", ondelete="SET NULL"), nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tutor = relationship("TutorDetail", back_populates="courses")
    category = relationship("CourseCategory", back_populates="courses")
    ragSources = relationship("CourseRagSource", back_populates="course", cascade="all, delete-orphan")


class CourseCategory(Base):
    __tablename__ = "CourseCategory"

    id = Column(String, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    courses = relationship("Course", back_populates="category")


class Order(Base):
    __tablename__ = "Order"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, default="pending")
    reference = Column(String, unique=True, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="orders")


class LiveClass(Base):
    __tablename__ = "LiveClass"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    instructorId = Column(String, nullable=False)
    startTime = Column(DateTime, nullable=False)
    meetingId = Column(String, nullable=True)
    joinUrl = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Book(Base):
    __tablename__ = "Book"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    status = Column(String, default="Draft")
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    purchases = relationship("BookPurchase", back_populates="book", cascade="all, delete-orphan")


class BookPurchase(Base):
    __tablename__ = "BookPurchase"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    bookId = Column(String, ForeignKey("Book.id", ondelete="CASCADE"), nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="bookPurchases")
    book = relationship("Book", back_populates="purchases")


class Assignment(Base):
    __tablename__ = "Assignment"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    status = Column(String, default="pending")
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="assignments")


class Note(Base):
    __tablename__ = "Note"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notes")


class Review(Base):
    __tablename__ = "Review"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    courseId = Column(String, nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="reviews")


class DiscussionThread(Base):
    __tablename__ = "DiscussionThread"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    authorId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    author = relationship("User", back_populates="discussionThreads")
    messages = relationship("DiscussionMessage", back_populates="thread", cascade="all, delete-orphan")


class DiscussionMessage(Base):
    __tablename__ = "DiscussionMessage"

    id = Column(String, primary_key=True)
    threadId = Column(String, ForeignKey("DiscussionThread.id", ondelete="CASCADE"), nullable=False)
    authorId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    content = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    thread = relationship("DiscussionThread", back_populates="messages")
    author = relationship("User", back_populates="discussionMessages")


class Conversation(Base):
    __tablename__ = "Conversation"

    id = Column(String, primary_key=True)
    participantIds = Column(ARRAY(String))
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "Message"

    id = Column(String, primary_key=True)
    conversationId = Column(String, ForeignKey("Conversation.id", ondelete="CASCADE"), nullable=False)
    senderId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    content = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sentMessages")


class Classroom(Base):
    __tablename__ = "Classroom"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    tutorId = Column(String, nullable=False)
    enrolledStudentIds = Column(ARRAY(String))
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    messages = relationship("ClassroomMessage", back_populates="classroom", cascade="all, delete-orphan")
    presence = relationship("ClassroomPresence", back_populates="classroom", cascade="all, delete-orphan")


class ClassroomMessage(Base):
    __tablename__ = "ClassroomMessage"

    id = Column(String, primary_key=True)
    classroomId = Column(String, ForeignKey("Classroom.id", ondelete="CASCADE"), nullable=False)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    content = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    classroom = relationship("Classroom", back_populates="messages")
    user = relationship("User", back_populates="classroomMessages")


class ClassroomPresence(Base):
    __tablename__ = "ClassroomPresence"

    id = Column(String, primary_key=True)
    classroomId = Column(String, ForeignKey("Classroom.id", ondelete="CASCADE"), nullable=False)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    lastActive = Column(DateTime, default=datetime.datetime.utcnow)

    classroom = relationship("Classroom", back_populates="presence")
    user = relationship("User", back_populates="classroomPresence")


class PayoutRequest(Base):
    __tablename__ = "PayoutRequest"

    id = Column(String, primary_key=True)
    tutorId = Column(String, ForeignKey("TutorDetail.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, default="pending")
    adminNote = Column(String, nullable=True)
    reviewedBy = Column(String, nullable=True)
    reviewedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    tutor = relationship("TutorDetail", back_populates="payoutRequests")


class Achievement(Base):
    __tablename__ = "Achievement"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    badgeUrl = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="achievements")


class SupportTicket(Base):
    __tablename__ = "SupportTicket"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    status = Column(String, default="open")
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="supportTickets")


class Notification(Base):
    __tablename__ = "Notification"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    isRead = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class CourseRagSource(Base):
    __tablename__ = "CourseRagSource"

    id = Column(String, primary_key=True)
    courseId = Column(String, ForeignKey("Course.id", ondelete="CASCADE"), nullable=False)
    sourceFile = Column(String, nullable=False)
    contentHash = Column(String, nullable=False)
    chunkCount = Column(Integer, default=1)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    course = relationship("Course", back_populates="ragSources")

    __table_args__ = (
        UniqueConstraint('courseId', 'sourceFile', name='_course_source_uc'),
    )
