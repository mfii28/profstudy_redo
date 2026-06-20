import { redirect } from 'next/navigation';

export default function LegacyDashboardSettingsPage() {
  redirect('/student-dashboard/settings/profile');
}
