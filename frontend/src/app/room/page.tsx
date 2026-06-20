import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function RoomIndexPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 sm:p-8 text-center space-y-4">
        <h1 className="text-2xl font-black tracking-tight">Live Classroom</h1>
        <p className="text-sm text-muted-foreground">
          Open a classroom from your dashboard class list. This room experience runs as a standalone full-screen page.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/student-dashboard/classroom">Student Classes</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/tutor-dashboard/classroom">Tutor Classes</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/classroom">Admin Classes</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
