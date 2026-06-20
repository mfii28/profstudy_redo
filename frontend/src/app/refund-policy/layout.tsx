import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'Understand the refund and cancellation policies for courses and products purchased on Profs Training Solutions.',
};

export default function RefundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
