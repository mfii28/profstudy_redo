import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Photos and videos from classes, events, and graduations at Profs Training Solutions.',
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
