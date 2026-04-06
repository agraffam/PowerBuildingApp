import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { applyInstanceBodyweightOverride } from "@/lib/bodyweight-scope";

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: { programExerciseId?: string; useBodyweight?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.programExerciseId || typeof body.useBodyweight !== "boolean") {
    return NextResponse.json({ error: "programExerciseId and useBodyweight required" }, { status: 400 });
  }

  const instance = await prisma.programInstance.findFirst({
    where: { status: "ACTIVE", userId },
    select: { id: true },
  });
  if (!instance) {
    return NextResponse.json({ error: "No active program" }, { status: 404 });
  }

  try {
    await applyInstanceBodyweightOverride({
      userId,
      programInstanceId: instance.id,
      programExerciseId: body.programExerciseId,
      useBodyweight: body.useBodyweight,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "BAD_PE") return NextResponse.json({ error: "Invalid exercise slot" }, { status: 400 });
    throw e;
  }
}
