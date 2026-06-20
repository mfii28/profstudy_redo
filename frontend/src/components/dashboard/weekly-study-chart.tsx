'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { WeeklyStudyData } from '@/lib/db';

const chartConfig = {
  hours: {
    label: 'Hours',
    color: 'hsl(var(--accent))',
  },
} satisfies ChartConfig;

export function WeeklyStudyChart({ data }: { data: WeeklyStudyData[] }) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(value) => `${value}h`}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar dataKey="hours" fill="var(--color-hours)" radius={8} />
      </BarChart>
    </ChartContainer>
  );
}
