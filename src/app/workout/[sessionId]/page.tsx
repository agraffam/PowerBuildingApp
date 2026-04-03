import { WorkoutSessionView } from "@/components/training/workout-session-view";

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <WorkoutSessionView sessionId={sessionId} />;
}
