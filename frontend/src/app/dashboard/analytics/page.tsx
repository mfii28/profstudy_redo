import { redirect } from 'next/navigation';

export default function LegacyDashboardAnalyticsPage() {
  redirect('/student-dashboard/progress');
}
