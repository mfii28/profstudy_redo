import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Tutor',
  description: 'Share your expertise on Profs Training Solutions. Apply to become an instructor and reach thousands of learners worldwide.',
};

export default function TeachLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
