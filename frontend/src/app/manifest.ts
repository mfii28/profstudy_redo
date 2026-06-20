import type { MetadataRoute } from 'next';

const APP_NAME = 'Profs Training Solutions';
const APP_SHORT_NAME = 'Profs';
const APP_DESCRIPTION =
  'ICAG and CITG professional tuition in Ghana — online classes, exam prep, and study tools.';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: '#0f172a',
    lang: 'en-GH',
    dir: 'ltr',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Student dashboard',
        short_name: 'Dashboard',
        url: '/student-dashboard',
        icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
      },
      {
        name: 'My courses',
        short_name: 'Courses',
        url: '/student-dashboard/my-courses',
        icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
      },
      {
        name: 'Browse courses',
        short_name: 'Browse',
        url: '/courses',
        icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
      },
    ],
  };
}
