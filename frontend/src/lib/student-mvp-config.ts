export type StudentNavIconKey =
  | 'dashboard'
  | 'search'
  | 'bookOpen'
  | 'megaphone'
  | 'bookMarked'
  | 'tv'
  | 'sparkles'
  | 'creditCard'
  | 'receipt'
  | 'settings'
  | 'monitor'
  | 'star'
  | 'ticket'
  | 'trendingUp';

export type StudentNavSubItemConfig = {
  name: string;
  href: string;
  iconKey?: StudentNavIconKey;
  badge?: string;
};

export type StudentNavItemConfig = {
  name: string;
  href?: string;
  iconKey: StudentNavIconKey;
  badge?: string;
  subItems?: StudentNavSubItemConfig[];
};

export type StudentNavGroupConfig = {
  title: string;
  items: StudentNavItemConfig[];
};

/** Legacy/alias paths that should redirect to their canonical equivalents. */
export const STUDENT_CANONICAL_REDIRECTS: Record<string, string> = {
  '/student-dashboard/my-courses': '/student-dashboard/my-learning',
  '/student-dashboard/settings': '/student-dashboard/settings/profile',
};

/** Non-MVP student module prefixes that should redirect back to /student-dashboard. */
export const STUDENT_MVP_BLOCKED_PREFIXES: string[] = [
  // Implemented — no longer blocked:
  // '/student-dashboard/achievements',  → src/app/student-dashboard/achievements/page.tsx
  // '/student-dashboard/orders',        → src/app/student-dashboard/orders/page.tsx
  // '/student-dashboard/progress',      → src/app/student-dashboard/progress/page.tsx
  // '/student-dashboard/reviews',       → src/app/student-dashboard/reviews/page.tsx
  // '/student-dashboard/support',       → src/app/student-dashboard/support/page.tsx

  // Future features — blocked until implemented:
  '/student-dashboard/alumni',
  '/student-dashboard/analytics',
  '/student-dashboard/assignments',
  '/student-dashboard/chat',
  '/student-dashboard/discussions',
  '/student-dashboard/leaderboards',
  '/student-dashboard/mentorship',
  '/student-dashboard/notes',
  '/student-dashboard/rewards-store',
  '/student-dashboard/wishlist',
];

export const STUDENT_NAV_CONFIG: StudentNavGroupConfig[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/student-dashboard', iconKey: 'dashboard' },
      { name: 'Browse Courses', href: '/student-dashboard/browse-courses', iconKey: 'search' },
    ],
  },
  {
    title: 'Learning',
    items: [
      { name: 'My Learning', href: '/student-dashboard/my-learning', iconKey: 'bookOpen' },
      { name: 'Announcements', href: '/student-dashboard/announcements', iconKey: 'megaphone' },
      { name: 'Books', href: '/student-dashboard/books', iconKey: 'bookMarked' },
      { name: 'Live Classes', href: '/student-dashboard/live-classes', iconKey: 'tv' },
      { name: 'Live Classroom', href: '/student-dashboard/classroom', iconKey: 'monitor' },
    ],
  },
  {
    title: 'AI Tools',
    items: [
      {
        name: 'AI Study Tutor',
        href: '/student-dashboard/ai-assistant',
        iconKey: 'sparkles',
        subItems: [
          { name: 'Study Assistant', href: '/student-dashboard/ai-assistant', iconKey: 'sparkles' },
        ],
      },
    ],
  },
  {
    title: 'Progress & Activity',
    items: [
      { name: 'My Progress', href: '/student-dashboard/progress', iconKey: 'bookOpen' },
      { name: 'Achievements', href: '/student-dashboard/achievements', iconKey: 'star' },
      { name: 'My Reviews', href: '/student-dashboard/reviews', iconKey: 'megaphone' },
    ],
  },
  {
    title: 'Account',
    items: [
      { name: 'Order History', href: '/student-dashboard/orders', iconKey: 'receipt' },
      { name: 'My Purchases', href: '/student-dashboard/my-purchases', iconKey: 'receipt' },
      { name: 'Support', href: '/student-dashboard/support', iconKey: 'megaphone' },
      { name: 'Affiliates', href: '/affiliate', iconKey: 'trendingUp' },
      { name: 'Settings', href: '/student-dashboard/settings/profile', iconKey: 'settings' },
    ],
  },
];
