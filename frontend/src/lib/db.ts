import { z } from 'zod';

// Course Builder & Data Schemas
export const LessonTypeEnum = z.enum(['video', 'document', 'resource', 'text', 'pdf', 'quiz', 'assignment']);
export type LessonType = z.infer<typeof LessonTypeEnum>;

export type QuizQuestion = {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
};

export type Lesson = {
  id: string;
  title: string;
  type: LessonType;
  duration: number; // in minutes
  description?: string;
  contentUrl?: string;
  quiz?: QuizQuestion[];
};

export type Section = {
  id: string;
  title: string;
  lessons: Lesson[];
};

export type CourseStatus = 'Published' | 'Draft' | 'Under Review' | 'Rejected';

export type CourseBookRef = {
  id: string;
  title: string;
  price: number;
  isFree?: boolean;
};

export type ProgramCategory = {
  id: string;
  name: string;
};

export type CourseProgram = {
  id: string;
  name: string;
  categories: ProgramCategory[];
};

export type Review = {
    id: string;
    userId: string;
    course: string;
    rating: number;
    text: string;
    date: string;
    reply?: string;
    repliedAt?: string;
};

export type Course = {
  id: string;
  tutorId: string;
  createdByTutorId?: string;
  assignedTutorIds?: string[];
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  imageHint: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  level?: string;
  language: string;
  sections: Section[];
  price?: number;
  /** Course-only list price (excludes attached book prices). Total = listingPrice + sum(books). */
  listingPrice?: number;
  /** @deprecated Use listingPrice; still read for legacy documents. */
  basePrice?: number;
  isFree?: boolean;
  status?: CourseStatus;
  instructor?: {
    name: string;
    title: string;
    avatar: string;
    bio: string;
  };
  rating?: number;
  reviewsCount?: number;
  studentsCount?: number;
  whatYoullLearn?: string[];
  prerequisites?: string[];
  reviews?: Review[];
  updatedAt?: string;
  program?: string;
  cat_id?: string;
  featured?: boolean;
  videoUrl?: string;
  /** `premium` may exist on older documents and is treated as `paid` in the app. */
  priceStatus?: 'free' | 'paid' | 'premium';
  books?: CourseBookRef[];
  tag_ids?: string[];
};

export type LibraryAsset = {
  id: string;
  tutorId: string;
  name: string;
  type: 'video' | 'pdf' | 'document' | 'image';
  url: string;
  size: string;
  createdAt: string;
};

export type Product = {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

export type CourseCategory = {
  id: string;
  name: string;
  description: string;
};

export type CourseBundle = {
    id: string;
    name: string;
    description: string;
    price: number;
    courseIds: string[];
};

// AI Interactions & Persistence
export type AiInteractionType =
  | 'TutoringChat'
  | 'SummaryRequest'
  | 'StudyPlanGeneration'
  | 'QuizGeneration'
  | 'FlashcardGeneration'
  | 'ExamPractice';

export type AiInteraction = {
    id: string;
    userId: string;
    type: AiInteractionType;
    courseId?: string;
    lessonId?: string;
    prompt: string;
    response: any; // Can be string, Quiz, or StudyPlan object
    timestamp: string;
    tokensUsed: number;
};

// User Profile Sub-Types
export type UserAddress = {
    line1: string;
    line2?: string;
    city: string;
    region: string;
    zip: string;
    phone: string;
};

export type UserPreferences = {
    theme: 'light' | 'dark' | 'system';
    notifCourseAnnouncements: boolean;
    notifStudyReminders: boolean;
    notifPromotions: boolean;
};

export type TutorDetails = {
    totalStudents: number;
    monthlyEarnings: number;
    avgRating: number;
    coursesTaught: string[];
    totalRevenue: number;
    bankName?: string;
    accountNumber?: string;
    momoNumber?: string;
    payoutMethod?: 'bank' | 'momo';
    bankAccountName?: string;
    momoNetwork?: 'MTN' | 'Vodafone' | 'AirtelTigo';
    payoutPhoneNumber?: string;
    verificationStatus?: 'unverified' | 'pending' | 'verified';
    idCardUrl?: string;
    certificationUrl?: string;
}

export type Permission = string; 

export type Role = {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
};

export type AiUsage = {
    tokensRemaining: number;
    lastResetDate: string;
};

export type Enrollment = {
    courseId: string;
    enrolledDate: string;
    completedLessons: string[];
};

export type Affiliate = {
    id: string;
    name?: string;
    email?: string;
    referrals: number;
    cashbackPercent: number;
    totalEarnings: number;
    status: 'active' | 'inactive';
    joinedDate: string;
};

export type AffiliateDiscountRewards = {
  totalReferrals: number;
  discountPercentAvailable: number;
  history: Array<{
    id: string;
    at: string;
    kind: 'referral_purchase' | 'discount_applied';
    percentDelta: number;
    paymentReference?: string;
    refereeUserId?: string;
    note?: string;
  }>;
};

export type User = {
    id: string; 
    name: string;
    email: string;
    phone_number?: string;                    // E.164 format, e.g., "+233201234567"
    /** Student / institution ID; any string (trimmed), max length enforced in app only */
    student_registration_number?: string;
    avatar: string;
    bio: string;
    isPremium: boolean;
    studyStreak: number;
    pointsSpent?: number;
    createdAt?: string;
    lastActive?: string;
    aiUsage: AiUsage;
    enrollments: Enrollment[];
    wishlistCourseIds?: string[];
    role: 'student' | 'tutor' | 'admin' | 'subadmin' | 'superadmin';
    roleId?: string;
    /** When false, tutor onboarding is limited until an admin approves. */
    tutorApproved?: boolean;
    tutorDetails?: TutorDetails;
    status: 'active' | 'suspended';
    referredBy?: string; 
    affiliateProfile?: Affiliate; 
    affiliate_link?: string;                 // Optional referral URL
    /** Non-cash referral rewards: discount % available on next checkouts */
    affiliateDiscountRewards?: AffiliateDiscountRewards;
    address?: UserAddress;
    preferences?: UserPreferences;
    phoneVerified?: boolean;                 // Tracks if phone has been verified
    registrationVerified?: boolean;          // Tracks registration number verification status
    emailVerified?: boolean;                 // True once email OTP is confirmed
    otpHash?: string;                        // SHA-256 hash of the pending OTP code (if stored inline)
    otpExpiresAt?: string;                   // ISO expiry timestamp for the pending OTP
    otpAttempts?: number;                    // Number of failed OTP attempts
};

export type AssignmentStatus = 'Pending' | 'Submitted' | 'Graded' | 'Late';

export type Assignment = {
    id: string;
    userId: string;
    course: string;
    title: string;
    dueDate: string;
    status: AssignmentStatus;
    grade: string;
    submissionUrl?: string;
    submittedAt?: string;
}

export type Achievement = {
    id: string;
    userId: string;
    title: string;
    description: string;
    date: string | null;
    isUnlocked: boolean;
    icon: string;
};

export type DiscussionMessage = {
    id: string;
    authorId: string;
    content: string;
    timestamp: string;
};

export type DiscussionThread = {
    id: string;
    title: string;
    course: string;
    authorId: string;
    replies: number;
    lastActivity: string;
    messages?: DiscussionMessage[];
};

export type Note = {
    id: string;
    userId: string;
    course: string;
  lessonId?: string;
    lessonTitle?: string;
    title: string;
    date: string;
    snippet: string;
};

export type Notification = {
    id: string;
    userId: string;
    title: string;
    description: string;
    time: string;
    read: boolean;
    category: string;
};

export type OrderStatus = 'Delivered' | 'Processing' | 'Cancelled' | 'Preparing to Ship' | 'Shipped';

export type Order = {
    id: string;
    userId: string;
    orderId: string;
    date: string;
    total: number;
    status: OrderStatus;
    items: string;
    /** IDs of courses granted access to by this order (added by Paystack webhook) */
    courseIds?: string[];
    paymentMethod?: string;
    paymentReference?: string;
    shippingAddress?: string | null;
};

export type Payout = {
    id: string;
    tutorId: string;
    date: string;
    amount: number;
    method: 'Bank Transfer' | 'Mobile Money';
    status: 'Completed' | 'Processing' | 'Failed' | 'Pending';
}

export type PayoutRequestStatus = 'pending' | 'approved' | 'rejected';

export type PayoutRequest = {
    id: string;
    tutorId: string;
    amount: number;
    method: 'bank' | 'momo';
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    momoNumber?: string;
    momoNetwork?: 'MTN' | 'Vodafone' | 'AirtelTigo';
    note?: string;
    status: PayoutRequestStatus;
    submittedAt: string;
    reviewedAt?: string;
    adminNote?: string;
}

export type SupportTicketReply = {
    authorId: string;
    date: string;
    message: string;
};

export type SupportTicket = {
    id: string;
    userId: string;
    subject: string;
  description?: string;
    date: string;
    /** Legacy: Open / In Progress / Closed. New: open / pending / resolved */
    status: 'Open' | 'Closed' | 'In Progress' | 'open' | 'pending' | 'resolved';
    category: 'Technical Issue' | 'Billing & Payments' | 'Course Content' | 'Other';
    priority: 'Low' | 'Medium' | 'High';
    replies: SupportTicketReply[];
};

export type ContactInquiry = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
  status: 'Pending' | 'Resolved' | 'Archived';
  resolvedAt?: string;
  adminNotes?: string;
};

export type InstructorApplication = {
  id: string;
  applicantId?: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  linkedinProfileUrl?: string;
  portfolioUrl?: string;
  teachingExperienceDescription: string;
  proposedCourseTopics: string[];
  motivationStatement: string;
  submittedAt: string;
  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Withdrawn';
  reviewerId?: string;
  reviewedAt?: string;
  adminFeedback?: string;
};

export type AdminOnboardingFlowStep = {
  id: string;
  title: string;
  description: string;
  isEnabled: boolean;
};

  export type Book = {
    id: string;
    title: string;
    author: string;
    description: string;
    coverUrl: string;
    price: number;
    isFree?: boolean;
    type: 'digital' | 'physical';
    /** Firebase Storage key for the PDF — digital books only */
    fileKey?: string;
    isbn?: string;
    pages?: number;
    category: string;
    tags?: string[];
    status: 'Published' | 'Draft';
    rating?: number;
    reviewsCount?: number;
    /** Physical books only */
    stockCount?: number;
    shippingEst?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  export type BookDeliveryStatus = 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

  export type BookPurchase = {
    id: string;
    userId: string;
    bookId: string;
    bookTitle: string;
    bookType: 'digital' | 'physical';
    amount: number;
    purchasedAt: string;
    paymentReference?: string;
    orderReference?: string;
    receiptCode?: string;
    /** Physical books only */
    deliveryStatus?: BookDeliveryStatus;
    shippingAddress?: UserAddress;
    trackingReference?: string;
  };

export type WeeklyStudyData = {
    day: string;
    hours: number;
};

export type SubjectMasteryData = {
    subject: string;
    mastery: number;
};

export type LiveClass = {
  id: string;
  title: string;
  courseId?: string;
  meetingLink?: string;
  instructor: string;
  instructorId: string;
  startTime: string;
  durationMinutes?: number;
  /** upcoming/past = legacy; scheduled/live/ended = explicit lifecycle */
  status: 'upcoming' | 'past' | 'scheduled' | 'live' | 'ended';
  attendance?: string[]; // Array of userIds
};

export type BillingHistory = {
  id?: string;
  userId?: string;
    invoiceId: string;
    date: string;
  amount: string | number;
    status: 'Paid' | 'Pending' | 'Failed';
  description?: string;
  paymentMethod?: string;
};

export type TestimonialStatus = 'pending' | 'approved' | 'rejected';
export type TestimonialGroup = 'general' | 'icag' | 'citg' | 'events';

export type Testimonial = {
    name: string;
    role: string;
    avatar: string;
    text: string;
    status?: TestimonialStatus;
    group?: TestimonialGroup;
    submittedBy?: string;
    submittedAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    source?: 'admin' | 'user';
};

export type GalleryMediaType = 'image' | 'video';
export type GalleryItemStatus = 'draft' | 'published';
export type GalleryGroup = 'general' | 'icag' | 'citg' | 'events' | 'graduation';

export type GalleryItem = {
    title: string;
    caption?: string;
    mediaUrl: string;
    mediaType: GalleryMediaType;
    group: GalleryGroup;
    status: GalleryItemStatus;
    sortOrder?: number;
    createdAt: string;
    updatedAt?: string;
};

export type Announcement = {
  id: string;
  title: string;
  message: string;
  type: 'Info' | 'Warning' | 'Promotion';
  priority?: 'Low' | 'Medium' | 'High';
  isActive?: boolean;
  expiresAt?: string;
  date: string;
  authorId?: string;
  courseId?: string;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverUrl?: string;
  authorId: string;
  authorName?: string;
  category: string;
  tags?: string[];
  status: 'Draft' | 'Published';
  publishedAt?: string;
  createdAt: string;
  updatedAt?: string;
  viewCount?: number;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  usageCount?: number;
  createdAt: string;
};

export type FreeResource = {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'document' | 'pdf' | 'link';
  url?: string;
  fileKey?: string;
  thumbnailUrl?: string;
  category: string;
  tags?: string[];
  isFeatured?: boolean;
  viewCount?: number;
  createdAt: string;
  updatedAt?: string;
};

export type BookReview = {
  id: string;
  bookId: string;
  bookTitle?: string;
  userId: string;
  userName?: string;
  rating: number;
  text: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string;
  adminReply?: string;
  repliedAt?: string;
};

export type FunnelDataPoint = {
    name: string;
    value: number;
    fill: string;
};

export type ForecastDataPoint = {
    month: string;
    revenue: number;
    projected: number;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: string;
  interval: 'month' | 'year';
  activeSubscribers: number;
  features: string[];
}

export type Subscription = {
    id: string;
    userId: string;
    planName: string;
    price: string;
    status: 'Active' | 'Cancelled' | 'Expired';
    nextPaymentDate: string;
};

export type PersonalizedStudyPlanOutput = {
  studyPlan: {
    date: string;
    tasks: {
      id: string;
      courseTitle: string;
      moduleTitle: string;
      estimatedHours: number;
      description: string;
      isCompleted: boolean;
    }[];
  }[];
  summary: string;
  notes?: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetId: string;
  targetType: 'user' | 'course' | 'payout' | 'order' | 'setting' | 'organization' | 'product';
  timestamp: string;
  details: string;
  severity: 'info' | 'warn' | 'critical';
};

export type Organization = {
    id: string;
    name: string;
    contactPerson: string;
    contactEmail: string;
    studentSeats: number;
    seatsUsed: number;
    status: 'Active' | 'Suspended';
    createdAt: string;
};

export type IpBlock = {
    id: string;
    ip: string;
    reason: string;
    blockedBy: string;
    timestamp: string;
};

export type GlobalSettings = {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  supportEmail: string;
  supportPhone: string;
  businessAddress: string;
  logoUrl?: string;
  defaultLanguage: string;
  defaultCurrency: string;
  timezone: string;
  dateFormat: string;
  smtpServer: string;
  smtpPortTls: string;
  smtpPortSsl: string;
  smtpUser: string;
  smtpPass: string;
  defaultCoursePrice: string;
  minCoursePrice: string;
  maxCoursePrice: string;
  maxDiscountPct: string;
  taxEnabled: boolean;
  taxPct: string;
  invoicePrefix: string;
  payoutThreshold: string;
  payoutFrequency: string;
  platformCommission: string;
  defaultStudentTokens: string;
  defaultTutorTokens: string;
  enableAutoCourseReview: boolean;
  enableAutoCategorization: boolean;
  aiModelTier: 'flash' | 'pro';
  maintenanceMode: boolean;
  blockExternalLinksInChat: boolean;
  enableAutoFlagging: boolean;
  loginAttemptLimit: string;
  requireTutorVerification: boolean;
  requireStudentId: boolean;
  studentToTutorMessaging: boolean;
  allowReviewAutoApproval: boolean;
  affiliateCommissionPct: string;
  affiliateApprovalRequired: boolean;
  tutorAnalyticsAccess: boolean;
  contentOwnership: string;
  gdprEnabled: boolean;
  dataRetentionDays: string;
  // Registration
  allowPublicRegistration: boolean;
  // Notification preferences
  notifNewUserAlert: boolean;
  notifNewCourseAlert: boolean;
  notifNewOrderAlert: boolean;
  notifPayoutRequest: boolean;
  notifSecurityAlert: boolean;
  // File upload limits
  maxUploadMb: string;
  allowedImageTypes: string;
  allowedVideoTypes: string;
  allowedDocTypes: string;
  // Social media links
  socialFacebook?: string;
  socialInstagram?: string;
  socialTwitter?: string;
  socialLinkedin?: string;
  socialYoutube?: string;
  // Communication channels
  commSmsEnabled?: boolean;
  commWhatsappEnabled?: boolean;
  commEmailEnabled?: boolean;
  commInAppEnabled?: boolean;
  commOtpSmsEnabled?: boolean;
  commOtpWhatsappEnabled?: boolean;
  commRetryLimit?: string;
  commRateLimitPerMinute?: string;
};

export interface CartItem {
  id: string;
  productId?: string;
  courseId?: string;
  title: string;
  price: number;
  basePrice?: number;
  attachedBookId?: string;
  attachedBookTitle?: string;
  attachedBookPrice?: number;
  coursePurchaseOption?: 'course_only' | 'course_with_book';
  imageUrl: string;
  description: string;
  itemType: 'course' | 'product';
  quantity: number;
}

export type MentorshipBooking = {
    id: string;
    userId: string;
    tutorId: string;
    tutorName: string;
    date: string;
    status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
    topic: string;
};

export type ClaimedReward = {
    id: string;
    userId: string;
    rewardId: string;
    rewardTitle: string;
    date: string;
    pointsSpent: number;
};

export type LegalDocument = {
  title: string;
  content: string;
};

export type LegalDocuments = {
  terms: LegalDocument;
  privacy: LegalDocument;
  refund: LegalDocument;
};

// Live Classroom
export type ClassroomChannel = 'general' | 'lectures' | 'qa';

export type ClassroomMemberRole = 'classroom-admin' | 'classroom-author' | 'classroom-student';

export type ClassroomMember = {
  userId: string;
  classroomRole: ClassroomMemberRole;
  addedAt: string;
  addedBy: string;
};

export type PinnedMessage = {
  messageId: string;
  text: string;
  userName: string;
  pinnedAt: string;
  pinnedBy: string;
  channel: ClassroomChannel;
};

export type Classroom = {
  id: string;
  courseId: string;
  courseTitle: string;
  subject?: string;
  category: string;
  description: string;
  tutorId: string;
  createdById?: string;
  createdByName?: string;
  status?: 'active' | 'inactive' | 'maintenance' | 'archived';
  maxCapacity?: number;
  memberCount?: number;
  members?: Array<string | ClassroomMember>;
  updatedAt?: string;
  createdAt: string;
  enrolledStudentIds: string[];
  pinnedMessages?: PinnedMessage[];
};

export type ClassroomMessage = {
  id: string;
  classroomId: string;
  channel: ClassroomChannel;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole: string;
  text: string;
  timestamp: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  reactions?: Record<string, string[]>;
  editedAt?: string;
  deleted?: boolean;
  // Thread support
  parentMessageId?: string;
  threadCount?: number;
  richContent?: string; // Tiptap JSON for rich text
  pendingReplyId?: string; // ID of message being replied to
};

export type UserPresence = {
  userId: string;
  classroomId: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  lastSeen: string;
  updatedAt: string;
};

export type ThreadMessage = {
  id: string;
  classroomId: string;
  parentMessageId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole: string;
  text: string;
  timestamp: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  reactions?: Record<string, string[]>;
  editedAt?: string;
  deleted?: boolean;
  richContent?: string; // Tiptap JSON for rich text
};
