import { ClassroomRoom } from '@/components/classroom/classroom-room';

interface Props {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ channel?: string | string[] }>;
}

export default async function RoomPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const { channel } = await searchParams;

  return (
    <ClassroomRoom
      courseId={courseId}
      backHref="/room"
      roomHref={`/room/${courseId}`}
      initialChannel={channel}
    />
  );
}
