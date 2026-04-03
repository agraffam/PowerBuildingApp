/**
 * One-time: link legacy single-tenant rows to a bootstrap User and copy strength profiles.
 * Run after first `prisma db push` with phase-1 schema (nullable userId + ExerciseStrengthProfile).
 * Safe to run multiple times (idempotent).
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const LEGACY_EMAIL = "legacy@localhost";
const LEGACY_PASSWORD = "ChangeMe123!";

const prisma = new PrismaClient();

async function main() {
  let legacyUser = await prisma.user.findUnique({ where: { email: LEGACY_EMAIL } });

  if (!legacyUser) {
    const passwordHash = await bcrypt.hash(LEGACY_PASSWORD, 10);
    legacyUser = await prisma.user.create({
      data: {
        email: LEGACY_EMAIL,
        passwordHash,
        name: "Legacy (migrated)",
      },
    });
    console.log("Created legacy user:", LEGACY_EMAIL, "(password:", LEGACY_PASSWORD + ")");
  }

  const settingsOrphans = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM UserSettings WHERE userId IS NULL`,
  );
  for (const s of settingsOrphans) {
    await prisma.userSettings.update({
      where: { id: s.id },
      data: { userId: legacyUser.id },
    });
    console.log("Linked UserSettings to legacy user");
  }

  if ((await prisma.userSettings.count({ where: { userId: legacyUser.id } })) === 0) {
    await prisma.userSettings.create({
      data: {
        userId: legacyUser.id,
        preferredWeightUnit: "LB",
        defaultRestSec: 120,
        plateIncrementLb: 2.5,
        plateIncrementKg: 2.5,
      },
    });
    console.log("Created default UserSettings for legacy user");
  }

  const instances = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM ProgramInstance WHERE userId IS NULL`,
  );
  for (const inst of instances) {
    await prisma.programInstance.update({
      where: { id: inst.id },
      data: { userId: legacyUser.id },
    });
    console.log("Linked ProgramInstance", inst.id);
  }

  await prisma.program.updateMany({ data: { ownerId: null } });

  const tableCheck = await prisma.$queryRaw<{ name: string }[]>`
    SELECT name FROM sqlite_master WHERE type='table' AND name='ExerciseStrengthProfile'
  `;
  if (tableCheck.length > 0) {
    const oldProfiles = await prisma.$queryRaw<
      { exerciseId: string; estimatedOneRm: number; weightUnit: string }[]
    >`SELECT exerciseId, estimatedOneRm, weightUnit FROM ExerciseStrengthProfile`;
    for (const p of oldProfiles) {
      await prisma.userStrengthProfile.upsert({
        where: {
          userId_exerciseId: { userId: legacyUser.id, exerciseId: p.exerciseId },
        },
        create: {
          userId: legacyUser.id,
          exerciseId: p.exerciseId,
          estimatedOneRm: p.estimatedOneRm,
          weightUnit: p.weightUnit as "KG" | "LB",
        },
        update: {
          estimatedOneRm: p.estimatedOneRm,
          weightUnit: p.weightUnit as "KG" | "LB",
        },
      });
    }
    if (oldProfiles.length) {
      console.log("Copied", oldProfiles.length, "strength profiles to UserStrengthProfile");
    }
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "ExerciseStrengthProfile"`);
  }

  const exercisesWithBar = await prisma.exercise.findMany({
    where: { barIncrementLb: { not: null } },
  });
  for (const ex of exercisesWithBar) {
    if (ex.barIncrementLb == null) continue;
    await prisma.userExerciseLift.upsert({
      where: {
        userId_exerciseId: { userId: legacyUser.id, exerciseId: ex.id },
      },
      create: {
        userId: legacyUser.id,
        exerciseId: ex.id,
        barIncrementLb: ex.barIncrementLb,
      },
      update: { barIncrementLb: ex.barIncrementLb },
    });
  }

  console.log("Backfill complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
