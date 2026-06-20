import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function StudentClassroomQaPage({ params }: Props) {
  const { courseId } = await params;
  redirect(`/room/${courseId}/qa`);
}
