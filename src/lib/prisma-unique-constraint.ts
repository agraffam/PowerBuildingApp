import { Prisma } from "@prisma/client";

/** True when Prisma hit a unique index (e.g. duplicate email). Safe under concurrent register / email change. */
export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
