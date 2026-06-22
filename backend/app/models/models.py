from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class User(BaseModel):
    id: str = Field(alias="_id")
    email: str
    name: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    address: Optional[str] = None
    role: str = "student"
    status: str = "active"
    lastActive: Optional[datetime] = None
    studyStreak: int = 0
    pointsSpent: int = 0
    referredBy: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    isPremium: bool = False
    tutorApproved: bool = False

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "user-123",
                "email": "user@example.com",
                "role": "student"
            }
        }

class TutorDetail(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    totalStudents: int = 0
    avgRating: float = 0.0
    verificationStatus: str = "pending"
    idCardUrl: Optional[str] = None
    certificationUrl: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class Course(BaseModel):
    id: str = Field(alias="_id")
    title: str
    description: Optional[str] = None
    price: Optional[float] = None
    isFree: bool = False
    status: str = "Draft"
    tutorId: str
    categoryId: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class Order(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    amount: float
    status: str = "pending"
    reference: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class CartItem(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    courseId: Optional[str] = None
    bookId: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class BookPurchase(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    bookId: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class Classroom(BaseModel):
    id: str = Field(alias="_id")
    name: str
    tutorId: str
    enrolledStudentIds: List[str] = []
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class CourseRagSource(BaseModel):
    id: str = Field(alias="_id")
    courseId: str
    sourceFile: str
    contentHash: str
    chunkCount: int = 1
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
