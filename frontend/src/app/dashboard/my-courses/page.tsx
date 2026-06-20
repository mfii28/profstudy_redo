import { redirect } from 'next/navigation';

export default function LegacyDashboardMyCoursesPage() {
  redirect('/student-dashboard/my-courses');
}
