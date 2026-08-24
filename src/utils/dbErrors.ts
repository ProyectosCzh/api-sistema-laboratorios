import { Prisma } from "@prisma/client";
import { ApiErrors } from "./errors";

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

/**
 * Última línea de defensa ante carreras: si un INSERT/UPDATE de reserva choca
 * con los índices únicos parciales de celda activa (P2002), se traduce a un
 * conflicto 409 en lugar de propagarse como error 500. Los asserts de
 * slotAvailability.service siguen siendo la primera línea (mejor UX).
 */
export function mapReservationUniqueViolation(e: unknown): void {
  const violated = uniqueViolationColumns(e);
  if (!violated) return;
  const cellColumns = ["classroomId", "semesterId", "timeSlotId"];
  if (!cellColumns.every(c => violated.includes(c))) return;
  throw ApiErrors.reservationConflict();
}
