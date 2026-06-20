export type AdminNavRole = 'admin' | 'subadmin' | 'superadmin';

export type AdminNavIconKey =
  | 'dashboard'
  | 'users'
  | 'bookOpen'
  | 'tv'
  | 'store'
  | 'dollarSign'
  | 'ticket'
  | 'settings'
  | 'checkCheck'
  | 'hardDrive'
  | 'monitor'
  | 'barChart'
  | 'megaphone'
  | 'fileText'
  | 'tag'
  | 'download'
  | 'star'
  | 'userCircle'
  | 'shield'
  | 'activity'
  | 'database'
  | 'trendingUp'
  | 'building'
  | 'package';

export type AdminNavSubItemConfig = {
  name: string;
  href: string;
};

export type AdminNavItemConfig = {
  name: string;
  href?: string;
  iconKey: AdminNavIconKey;
  subItems?: AdminNavSubItemConfig[];
};

export type AdminNavGroupConfig = {
  title: string;
  role?: AdminNavRole;
  items: AdminNavItemConfig[];
};

export type AdminRouteMode = 'mvp' | 'full';

export const ADMIN_MVP_NAV_CONFIG: AdminNavGroupConfig[] = [
  {
    title: 'Core Management',
    items: [
      { name: 'Dashboard', href: '/admin', iconKey: 'dashboard' },
      {
        name: 'Analytics',
        href: '/admin/analytics',
        iconKey: 'barChart',
        subItems: [
          { name: 'Overview', href: '/admin/analytics' },
          { name: 'Cohort Analysis', href: '/admin/analytics/cohorts' },
          { name: 'Conversion Funnels', href: '/admin/analytics/funnels' },
          { name: 'Reports', href: '/admin/analytics/reports' },
        ],
      },
      {
        name: 'User Registry',
        href: '/admin/users',
        iconKey: 'users',
        subItems: [
          { name: 'All Accounts', href: '/admin/users' },
          { name: 'Students', href: '/admin/users/students' },
          { name: 'Instructors', href: '/admin/users/instructors' },
          { name: 'Roles & RBAC', href: '/admin/users/roles' },
          { name: 'Instructor Applications', href: '/admin/applications' },
          { name: 'Tutor Verification', href: '/admin/users/verification' },
          { name: 'Organizations', href: '/admin/users/organizations' },
          { name: 'My Profile', href: '/admin/users/profile' },
        ],
      },
    ],
  },
  {
    title: 'Academic Content',
    items: [
      {
        name: 'Course Catalog',
        href: '/admin/courses',
        iconKey: 'bookOpen',
        subItems: [
          { name: 'Review Pending', href: '/admin/courses' },
          { name: 'Create Course', href: '/admin/courses/create' },
          { name: 'Approved Courses', href: '/admin/courses/approved' },
          { name: 'Course Bundles', href: '/admin/courses/bundles' },
          { name: 'Manual Enrollment', href: '/admin/courses/enrollment' },
        ],
      },
      { name: 'Live Classes', href: '/admin/live-classes', iconKey: 'tv' },
      { name: 'Live Classroom', href: '/admin/classroom', iconKey: 'monitor' },
      {
        name: 'Media Library',
        href: '/admin/content/media',
        iconKey: 'hardDrive',
      },
    ],
  },
  {
    title: 'Content Hub',
    items: [
      {
        name: 'Site Content',
        href: '/admin/content/site',
        iconKey: 'fileText',
      },
      {
        name: 'Blog',
        href: '/admin/content/blog',
        iconKey: 'fileText',
      },
      {
        name: 'Tags',
        href: '/admin/content/tags',
        iconKey: 'tag',
      },
      {
        name: 'Free Resources',
        href: '/admin/content/free-resources',
        iconKey: 'download',
      },
      {
        name: 'Book Reviews',
        href: '/admin/content/reviews',
        iconKey: 'star',
      },
      {
        name: 'Testimonials',
        href: '/admin/content/student-stories',
        iconKey: 'star',
      },
      {
        name: 'Gallery',
        href: '/admin/content/gallery',
        iconKey: 'hardDrive',
      },
    ],
  },
  {
    title: 'Sales & Finance',
    items: [
      {
        name: 'Store Ops',
        href: '/admin/store',
        iconKey: 'store',
        subItems: [
          { name: 'Inventory', href: '/admin/store/products' },
          { name: 'Books', href: '/admin/store/books' },
          { name: 'Orders', href: '/admin/store/orders' },
          { name: 'Book Orders', href: '/admin/store/book-orders' },
        ],
      },
      {
        name: 'Revenue',
        href: '/admin/finance',
        iconKey: 'dollarSign',
        subItems: [
          { name: 'Payouts', href: '/admin/finance/payouts' },
          { name: 'Transaction Log', href: '/admin/finance/logs' },
          { name: 'Commissions', href: '/admin/finance/commissions' },
          { name: 'Subscriptions', href: '/admin/finance/subscriptions' },
          { name: 'Forecasting', href: '/admin/finance/forecasting' },
        ],
      },
    ],
  },
  {
    title: 'Marketing',
    items: [
      {
        name: 'Announcements',
        href: '/admin/marketing/announcements',
        iconKey: 'megaphone',
      },
      {
        name: 'Affiliates',
        href: '/admin/marketing/affiliates',
        iconKey: 'trendingUp',
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        name: 'Security',
        href: '/admin/security',
        iconKey: 'shield',
        subItems: [
          { name: 'Security Dashboard', href: '/admin/security' },
          { name: 'Audit Logs', href: '/admin/security/audit-logs' },
          { name: 'Device Sessions', href: '/admin/security/devices' },
        ],
      },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      {
        name: 'Support Desk',
        href: '/admin/support',
        iconKey: 'ticket',
        subItems: [
          { name: 'Support Tickets', href: '/admin/support' },
          { name: 'Contact Inquiries', href: '/admin/support/inquiries' },
        ],
      },
      {
        name: 'Platform Settings',
        href: '/admin/settings',
        iconKey: 'settings',
        subItems: [
          { name: 'General', href: '/admin/settings/general' },
          { name: 'Email Templates', href: '/admin/settings/email' },
          { name: 'Communications', href: '/admin/settings/communications' },
          { name: 'Communication Logs', href: '/admin/settings/communications/logs' },
          { name: 'Payment Config', href: '/admin/settings/payment' },
        ],
      },
      { name: 'Legal Compliance', href: '/admin/compliance', iconKey: 'checkCheck' },
      {
        name: 'System',
        href: '/admin/system-health',
        iconKey: 'activity',
        subItems: [
          { name: 'Health Monitor', href: '/admin/system-health' },
          { name: 'Backup & Recovery', href: '/admin/system/backup' },
        ],
      },
    ],
  },
];

const ADMIN_MVP_ALWAYS_ALLOWED_PATHS = ['/admin/login', '/admin/notifications'];

const navPaths = ADMIN_MVP_NAV_CONFIG.flatMap((group) =>
  group.items.flatMap((item) => {
    const paths: string[] = [];
    if (item.href && !item.subItems?.length) {
      paths.push(item.href);
    }
    if (item.subItems?.length) {
      // Always include the parent href so direct navigation to group root works
      if (item.href) paths.push(item.href);
      paths.push(...item.subItems.map((subItem) => subItem.href));
    }
    return paths;
  })
);

export const ADMIN_MVP_ALLOWED_PATHS = Array.from(
  new Set<string>([...navPaths, ...ADMIN_MVP_ALWAYS_ALLOWED_PATHS, '/admin'])
);

// Dynamic admin routes that are valid but cannot be represented
// as static href entries in the navigation config.
export const ADMIN_MVP_ALLOWED_DYNAMIC_PATTERNS: RegExp[] = [
  /^\/admin\/courses\/[^/]+\/edit$/,
  /^\/admin\/classroom\/[^/]+$/,
  /^\/admin\/classroom\/[^/]+\/(lectures|qa|messages)$/,
];

export function getAdminRouteMode(): AdminRouteMode {
  const mode = (process.env.ADMIN_ROUTE_MODE || '').trim().toLowerCase();
  return mode === 'full' ? 'full' : 'mvp';
}

export function isAllowedAdminPath(pathname: string): boolean {
  if (getAdminRouteMode() === 'full') {
    return pathname === '/admin' || pathname.startsWith('/admin/');
  }
  if (ADMIN_MVP_ALLOWED_PATHS.includes(pathname)) return true;
  return ADMIN_MVP_ALLOWED_DYNAMIC_PATTERNS.some((pattern) => pattern.test(pathname));
}
