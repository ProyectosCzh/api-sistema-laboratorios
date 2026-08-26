import { Prisma, PrismaClient } from "@prisma/client";
import { ApiErrors } from "../utils/errors";
import type { ReservationStatus } from "../types";

export const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

export type DbClient = Prisma.TransactionClient | PrismaClient;
export type TxClient = Prisma.TransactionClient;

/// Estados de reserva que ocupan espacio en la tabla semanal.
export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = ["PENDIENTE", "CONFIRMADA"];

/**
 * Convención temporal: todas las fechas calendario se normalizan a medianoche UTC
 * para derivar el día de la semana, garantizando coherencia entre clientes,
 * servidor y base de datos.
 */

export function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/// Convierte una fecha al día hábil del documento base (1 = Lunes ... 6 = Sábado).
/// Devuelve null para domingo (no laborable).
export function dayOfWeekFromDate(date: Date): number | null {
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? null : jsDay;
}

function nextUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

export interface SlotRef {
  classroomId: string;
  semesterId: string;
  dayOfWeek: number;
  timeSlotId: string;
}

interface ExclusionOptions {
  excludeScheduleId?: string;
  excludeReservationId?: string;
}

export async function assertClassroomBookable(tx: TxClient, classroomId: string): Promise<void> {
  const classroom = await tx.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, status: true },
  });
  if (!classroom) throw ApiErrors.notFound("Aula no encontrada");
  if (classroom.status !== "ACTIVA") throw ApiErrors.classroomUnavailable();

  const openMaintenance = await tx.maintenanceLog.count({
    where: { classroomId, status: { not: "COMPLETADO" } },
  });
  if (openMaintenance > 0) throw ApiErrors.classroomUnavailable("El aula tiene un mantenimiento abierto");
}

export async function loadSemesterOrThrow(db: DbClient, semesterId: string) {
  const semester = await db.semester.findUnique({
    where: { id: semesterId },
    select: { id: true, name: true, startDate: true, endDate: true, workingDays: true },
  });
  if (!semester) throw ApiErrors.notFound("Semestre no encontrado");
  return semester;
}

export function assertSemesterWorkingDay(
  semester: { workingDays: number[] },
  dayOfWeek: number | null
): void {
  if (dayOfWeek === null || !semester.workingDays.includes(dayOfWeek)) {
    throw ApiErrors.nonWorkingDay();
  }
}

export function assertDateWithinSemester(
  semester: { startDate: Date; endDate: Date },
  date: Date
): void {
  if (date < utcStartOfDay(semester.startDate) || date > utcStartOfDay(semester.endDate)) {
    throw ApiErrors.dateOutsideSemester();
  }
}

export async function assertTimeSlotExists(db: DbClient, timeSlotId: string): Promise<void> {
  const slot = await db.timeSlot.findUnique({ where: { id: timeSlotId }, select: { id: true } });
  if (!slot) throw ApiErrors.notFound("Turno no encontrado");
}

export async function loadActiveSubject(tx: TxClient, subjectId: string): Promise<void> {
  const subject = await tx.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, active: true },
  });
  if (!subject) throw ApiErrors.notFound("Materia no encontrada");
  if (!subject.active) throw ApiErrors.inactiveCatalogItem("La materia está inactiva y no puede usarse en horarios nuevos");
}

export async function loadActiveTeacher(tx: TxClient, teacherId: string): Promise<void> {
  const teacher = await tx.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true, active: true },
  });
  if (!teacher) throw ApiErrors.notFound("Docente no encontrado");
  if (!teacher.active) throw ApiErrors.inactiveCatalogItem("El docente está inactivo y no puede asignarse a horarios nuevos");
}

/**
 * Verifica que el mismo docente no tenga dos bloques en el mismo día y turno
 * dentro del semestre. El docente vive indirectamente en Schedule, por lo que
 * esta regla solo puede validarse a nivel de servicio.
 */
export async function assertNoTeacherConflict(
  tx: TxClient,
  teacherId: string | null,
  ref: { semesterId: string; dayOfWeek: number; timeSlotId: string },
  excludeScheduleId?: string
): Promise<void> {
  if (!teacherId) return;
  const conflict = await tx.schedule.findFirst({
    where: {
      teacherId,
      semesterId: ref.semesterId,
      dayOfWeek: ref.dayOfWeek,
      timeSlotId: ref.timeSlotId,
      ...(excludeScheduleId ? { NOT: { id: excludeScheduleId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) throw ApiErrors.teacherConflict();
}

/**
 * Disponibilidad de una celda semanal completa (bloques académicos y
 * reservas recurrentes). También detecta el choque inverso: reservas
 * puntuales dentro del semestre que caigan en ese mismo día y turno.
 *
 * SINGLE SOURCE OF TRUTH para validación de celdas:
 * - Verifica contra Schedule (bloque académico existente)
 * - Verifica contra Reservation recurrente activa en la misma celda
 * - Verifica contra Reservation puntual activa en el mismo día+turno
 * - NO existe constraint cruzado Schedule↔Reservation en la DB;
 *   esta función es la ÚNICA barrera de integridad entre ambos modelos.
 */
export async function assertRecurringSlotAvailable(
  tx: TxClient,
  slot: SlotRef,
  opts: ExclusionOptions = {}
): Promise<void> {
  const schedule = await tx.schedule.findFirst({
    where: {
      classroomId: slot.classroomId,
      semesterId: slot.semesterId,
      dayOfWeek: slot.dayOfWeek,
      timeSlotId: slot.timeSlotId,
      ...(opts.excludeScheduleId ? { NOT: { id: opts.excludeScheduleId } } : {}),
    },
    select: { id: true },
  });
  if (schedule) throw ApiErrors.reservationConflict();

  const semester = await tx.semester.findUniqueOrThrow({
    where: { id: slot.semesterId },
    select: { startDate: true, endDate: true },
  });

  const punctuals = await tx.reservation.findMany({
    where: {
      classroomId: slot.classroomId,
      semesterId: slot.semesterId,
      type: "PUNTUAL",
      timeSlotId: slot.timeSlotId,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      date: { gte: utcStartOfDay(semester.startDate), lte: utcStartOfDay(semester.endDate) },
      ...(opts.excludeReservationId ? { NOT: { id: opts.excludeReservationId } } : {}),
    },
    select: { id: true, date: true },
  });
  const clashes = punctuals.some(p => p.date !== null && dayOfWeekFromDate(p.date) === slot.dayOfWeek);
  if (clashes) throw ApiErrors.reservationConflict();

  const recurring = await tx.reservation.findFirst({
    where: {
      classroomId: slot.classroomId,
      semesterId: slot.semesterId,
      type: "RECURRENTE",
      dayOfWeek: slot.dayOfWeek,
      timeSlotId: slot.timeSlotId,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      ...(opts.excludeReservationId ? { NOT: { id: opts.excludeReservationId } } : {}),
    },
    select: { id: true },
  });
  if (recurring) throw ApiErrors.reservationConflict();
}

/**
 * Disponibilidad de una reserva puntual (fecha concreta + turno).
 * Choca con toda ocupación recurrente de esa celda y con otra reserva
 * puntual activa en la misma fecha y turno.
 */
export async function assertPunctualSlotAvailable(
  tx: TxClient,
  slot: { classroomId: string; semesterId: string; date: Date; timeSlotId: string },
  opts: ExclusionOptions = {}
): Promise<void> {
  const dayOfWeek = dayOfWeekFromDate(slot.date);
  if (dayOfWeek === null) throw ApiErrors.nonWorkingDay("El domingo no es día hábil");

  await assertRecurringSlotAvailable(
    tx,
    {
      classroomId: slot.classroomId,
      semesterId: slot.semesterId,
      dayOfWeek,
      timeSlotId: slot.timeSlotId,
    },
    { excludeReservationId: opts.excludeReservationId }
  );

  const punctual = await tx.reservation.findFirst({
    where: {
      classroomId: slot.classroomId,
      semesterId: slot.semesterId,
      type: "PUNTUAL",
      timeSlotId: slot.timeSlotId,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      date: { gte: utcStartOfDay(slot.date), lt: nextUtcDay(slot.date) },
      ...(opts.excludeReservationId ? { NOT: { id: opts.excludeReservationId } } : {}),
    },
    select: { id: true },
  });
  if (punctual) throw ApiErrors.reservationConflict();
}
