import { redirect } from 'next/navigation';

export default function LegacyDashboardCommunityPage() {
  redirect('/student-dashboard/classroom');
}
