import { Prisma } from "@prisma/client";

export function uniqueViolationColumns(e: unknown): string[] | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (e.code !== "P2002") return null;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === "string");
  if (typeof target === "string") return [target];
  return null;
}

export function isUniqueViolationOn(e: unknown, columns: string[]): boolean {
  const violated = uniqueViolationColumns(e);
  if (!violated || violated.length !== columns.length) return false;
  return columns.every(c => violated.includes(c));
}
