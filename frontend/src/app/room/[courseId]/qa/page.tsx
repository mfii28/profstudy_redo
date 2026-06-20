import { ClassroomRoom } from '@/components/classroom/classroom-room';

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function RoomQaPage({ params }: Props) {
  const { courseId } = await params;

  return (
    <ClassroomRoom
      courseId={courseId}
      backHref="/room"
      roomHref={`/room/${courseId}`}
      initialChannel="qa"
    />
  );
}
