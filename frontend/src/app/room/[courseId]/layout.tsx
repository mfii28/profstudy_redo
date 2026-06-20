import { ReactNode } from 'react';

export default function RoomLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-full overflow-hidden">
      {children}
    </div>
  );
}
