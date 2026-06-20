import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Courses',
  description: 'Explore our catalog of expert-led courses. Learn new skills with AI-powered personalized study paths, quizzes, and certificates.',
};

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
