'use client';

import { SupportTicketsPage } from '@/components/support/support-tickets-page';

export default function StudentSupportPage() {
  return (
    <SupportTicketsPage
      title="Support"
      description="Open a ticket and our team will get back to you."
      emptyDescription="Need help with a course, billing, or your account? Open your first ticket and we'll respond as soon as we can."
    />
  );
}
