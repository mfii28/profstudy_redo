import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function StudentClassroomMessagesPage({ params }: Props) {
  const { courseId } = await params;
  redirect(`/room/${courseId}/messages`);
}
