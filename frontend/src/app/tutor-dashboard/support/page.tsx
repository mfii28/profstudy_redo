'use client';

import { SupportTicketsPage } from '@/components/support/support-tickets-page';

export default function TutorSupportPage() {
  return (
    <SupportTicketsPage
      title="Instructor support"
      description="Contact platform admin for account, payouts, or policy questions."
      emptyDescription="Questions about your instructor account, payouts, or platform policies? Open a ticket and the admin team will follow up."
    />
  );
}
