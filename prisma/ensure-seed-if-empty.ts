/**
 * If the DB has no exercises (typical fresh `prisma db push` / new Docker volume),
 * run the full seed so the exercise catalog and prebuilt programs exist.
 * Safe to run on every container start: no-op when data is already present.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const n = await prisma.exercise.count();
  await prisma.$disconnect();
  if (n === 0) {
    console.log("No exercises in database; running seed (catalog + programs + dev user)...");
    execSync("npm run db:seed", { stdio: "inherit", cwd: process.cwd(), env: process.env });
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
