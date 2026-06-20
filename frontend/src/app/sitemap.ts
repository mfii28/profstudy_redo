import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://profstrainingsolutions.com';
  const now = new Date();

  const routes = [
    '/',
    '/signup',
    '/login',
    '/courses',
    '/shop',
    '/about',
    '/contact',
    '/teach',
    '/testimonials',
    '/gallery',
    '/icag-online-classes',
    '/icag-tuition-ghana',
    '/icag-level-1-courses',
    '/icag-level-2-courses',
    '/icag-level-3-courses',
    '/icag-past-questions',
    '/icag-exam-prep',
    '/icag-registration',
    '/how-to-become-chartered-accountant-ghana',
    '/citg-online-classes',
    '/citg-tuition-provider-ghana',
    '/citg-exam-prep',
    '/citg-past-questions',
    '/citg-registration',
    '/how-to-become-tax-professional-ghana',
    '/courses/icag',
    '/courses/citg',
    '/courses/corporate-training',
    '/courses/digital-marketing',
    '/courses/business-growth',
    '/best-icag-tuition-center-ghana',
    '/best-citg-tuition-center-ghana',
    '/icag-crash-course',
    '/citg-crash-course',
    '/terms-of-service',
    '/privacy-policy',
    '/refund-policy',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route.startsWith('/icag') || route.startsWith('/citg') ? 0.9 : 0.7,
  }));
}
