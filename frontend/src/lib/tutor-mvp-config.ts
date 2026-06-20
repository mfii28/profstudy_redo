export type TutorNavIconKey =
  | 'dashboard'
  | 'bookOpen'
  | 'tv'
  | 'users'
  | 'star'
  | 'megaphone'
  | 'settings'
  | 'banknote'
  | 'hardDrive'
  | 'monitor'
  | 'ticket';

export type TutorNavSubItemConfig = {
  name: string;
  href: string;
};

export type TutorNavItemConfig = {
  name: string;
  href?: string;
  iconKey: TutorNavIconKey;
  subItems?: TutorNavSubItemConfig[];
};

export type TutorNavGroupConfig = {
  title: string;
  items: TutorNavItemConfig[];
};

export const TUTOR_NAV_CONFIG: TutorNavGroupConfig[] = [
  {
    title: 'Overview',
    items: [{ name: 'Dashboard', href: '/tutor-dashboard', iconKey: 'dashboard' }],
  },
  {
    title: 'Teaching',
    items: [
      {
        name: 'Courses',
        href: '/tutor-dashboard/courses',
        iconKey: 'bookOpen',
        subItems: [
          { name: 'Manage All', href: '/tutor-dashboard/courses' },
          { name: 'Create New', href: '/tutor-dashboard/courses/create' },
        ],
      },
      { name: 'Live Sessions', href: '/tutor-dashboard/live-sessions', iconKey: 'tv' },
      { name: 'Media Library', href: '/tutor-dashboard/media', iconKey: 'hardDrive' },
    ],
  },
  {
    title: 'Community',
    items: [
      { name: 'Live Classroom', href: '/tutor-dashboard/classroom', iconKey: 'monitor' },
      { name: 'Students', href: '/tutor-dashboard/students', iconKey: 'users' },
      { name: 'Reviews', href: '/tutor-dashboard/reviews', iconKey: 'star' },
      { name: 'Announcements', href: '/tutor-dashboard/announcements', iconKey: 'megaphone' },
      { name: 'Support', href: '/tutor-dashboard/support', iconKey: 'ticket' },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        name: 'Settings',
        href: '/tutor-dashboard/settings',
        iconKey: 'settings',
        subItems: [
          { name: 'Profile', href: '/tutor-dashboard/settings/profile' },
          { name: 'Address', href: '/tutor-dashboard/settings/address' },
          { name: 'Security', href: '/tutor-dashboard/settings/security' },
          { name: 'Preferences', href: '/tutor-dashboard/settings/preferences' },
          { name: 'Payout details', href: '/tutor-dashboard/settings/payout' },
          { name: 'Payout requests', href: '/tutor-dashboard/payouts' },
        ],
      },
    ],
  },
];

/** All tutor routes collected from the nav for reference and future gating. */
export const TUTOR_NAV_PATHS: string[] = Array.from(
  new Set(
    TUTOR_NAV_CONFIG.flatMap((group) =>
      group.items.flatMap((item) => {
        const paths: string[] = [];
        if (item.href) paths.push(item.href);
        item.subItems?.forEach((sub) => paths.push(sub.href));
        return paths;
      })
    )
  )
);
