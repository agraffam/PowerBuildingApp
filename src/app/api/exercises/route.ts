import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { STANDARD_BAR_INCREMENTS_LB } from "@/lib/calculators";
import { requireUserId } from "@/lib/auth/require-user";

export async function GET(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const tag = searchParams.get("tag")?.toLowerCase();

  const exercises = await prisma.exercise.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q } },
                { slug: { contains: q } },
                { muscleTags: { contains: q } },
              ],
            }
          : {},
        tag
          ? {
              muscleTags: { contains: tag },
            }
          : {},
      ],
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(exercises);
}

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    name?: string;
    muscleTags?: string;
    notes?: string | null;
    barIncrementLb?: number | null;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  let barIncrementLb: number | null = null;
  if (body.barIncrementLb != null) {
    const n = body.barIncrementLb;
    const ok = STANDARD_BAR_INCREMENTS_LB.some((s) => Math.abs(n - s) < 0.001);
    if (!ok) {
      return NextResponse.json({ error: "barIncrementLb must be 2.5, 5, 10, or omitted" }, { status: 400 });
    }
    barIncrementLb = STANDARD_BAR_INCREMENTS_LB.find((s) => Math.abs(n - s) < 0.001) ?? null;
  }

  const base = slugify(body.name);
  let slug = base;
  let n = 0;
  while (await prisma.exercise.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }

  const row = await prisma.exercise.create({
    data: {
      name: body.name.trim(),
      slug,
      muscleTags: body.muscleTags?.trim() ?? "",
      notes: body.notes?.trim() || null,
      barIncrementLb,
    },
  });
  return NextResponse.json(row);
}
