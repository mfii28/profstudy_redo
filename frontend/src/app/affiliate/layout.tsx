import type { ReactNode } from 'react';
import StudentDashboardLayout from '@/app/student-dashboard/layout';

export default function AffiliateLayout({ children }: { children: ReactNode }) {
  return <StudentDashboardLayout>{children}</StudentDashboardLayout>;
}
