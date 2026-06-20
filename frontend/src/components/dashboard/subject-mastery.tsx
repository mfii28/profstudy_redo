'use client';

import { Progress } from '@/components/ui/progress';
import { SubjectMasteryData } from '@/lib/db';

const getMasteryColor = (mastery: number) => {
  if (mastery >= 75) return 'bg-success';
  if (mastery >= 50) return 'bg-warning';
  return 'bg-destructive';
};

export function SubjectMastery({ data }: { data: SubjectMasteryData[] }) {
  return (
    <div className="space-y-6">
      {data.map((item) => (
        <div key={item.subject}>
          <div className="mb-2 flex justify-between">
            <span className="text-sm font-medium">{item.subject}</span>
            <span className="text-sm font-bold text-muted-foreground">{item.mastery}%</span>
          </div>
          <Progress value={item.mastery} indicatorClassName={getMasteryColor(item.mastery)} />
        </div>
      ))}
    </div>
  );
}
