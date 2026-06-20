import { ClassroomOverview } from '@/components/classroom/classroom-overview';
import { Monitor } from 'lucide-react';

export default function StudentClassroomPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Monitor className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black">Live Classrooms</h1>
          <p className="text-sm text-muted-foreground">Your active classroom spaces</p>
        </div>
      </div>
      <ClassroomOverview basePath="/student-dashboard/classroom" />
    </div>
  );
}
