import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Testimonials',
  description: 'Read student success stories and share your own experience with Profs Training Solutions.',
};

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
