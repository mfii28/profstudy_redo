import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ channel?: string | string[] }>;
}

export default async function StudentClassroomRoomPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const { channel } = await searchParams;

  const firstChannel = Array.isArray(channel) ? channel[0] : channel;
  if (firstChannel === 'lectures') {
    redirect(`/room/${courseId}/lectures`);
  }
  if (firstChannel === 'qa') {
    redirect(`/room/${courseId}/qa`);
  }

  redirect(`/room/${courseId}/messages`);
}
