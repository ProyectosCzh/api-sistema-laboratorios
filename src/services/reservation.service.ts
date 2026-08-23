import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import { buildMeta, buildPagination, PaginatedResult } from "../utils/pagination";
import type { Reservation, ReservationStatus, UserRole } from "../types";
import {
  TX_OPTIONS,
  assertClassroomBookable,
  assertDateWithinSemester,
  assertPunctualSlotAvailable,
  assertRecurringSlotAvailable,
  assertSemesterWorkingDay,
  assertTimeSlotExists,
  dayOfWeekFromDate,
  loadSemesterOrThrow,
  utcStartOfDay,
} from "./slotAvailability.service";

export const RESERVATION_INCLUDE = {
  timeSlot: true,
  classroom: { select: { id: true, code: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export interface ListReservationsOptions {
  status?: ReservationStatus;
  classroomId?: string;
  semesterId?: string;
  type?: "RECURRENTE" | "PUNTUAL";
  page: number;
  pageSize: number;
}

export async function listReservations(
  opts: ListReservationsOptions,
  viewer: { role: UserRole; id: string }
): Promise<PaginatedResult<Reservation>> {
  const { skip, take } = buildPagination(opts.page, opts.pageSize);

  const where: Prisma.ReservationWhereInput = {};
  if (opts.status) where.status = opts.status;
  if (opts.classroomId) where.classroomId = opts.classroomId;
  if (opts.semesterId) where.semesterId = opts.semesterId;
  if (opts.type) where.type = opts.type;
  // Los ayudantes solo ven sus propias reservas.
  if (viewer.role === "AYUDANTE") where.requestedById = viewer.id;

  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: RESERVATION_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { items: reservations.map(toReservation), meta: buildMeta(total, opts.page, opts.pageSize) };
}

export async function getReservation(
  id: string,
  viewer: { role: UserRole; id: string }
): Promise<Reservation> {
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: RESERVATION_INCLUDE });
  if (!reservation) throw ApiErrors.notFound("Reserva no encontrada");
  if (viewer.role === "AYUDANTE" && reservation.requestedById !== viewer.id) throw ApiErrors.forbidden();
  return toReservation(reservation);
}

interface CreateReservationData {
  classroomId: string;
  semesterId: string;
  type: "RECURRENTE" | "PUNTUAL";
  dayOfWeek?: number;
  date?: Date;
  timeSlotId: string;
  note?: string | null;
}

export async function createReservation(data: CreateReservationData, userId: string): Promise<Reservation> {
  await assertTimeSlotExists(prisma, data.timeSlotId);
  const semester = await loadSemesterOrThrow(prisma, data.semesterId);

  let dayOfWeek: number | null = null;
  let date: Date | null = null;

  if (data.type === "RECURRENTE") {
    if (!data.dayOfWeek) throw ApiErrors.validation([{ field: "dayOfWeek", message: "dayOfWeek es obligatorio para reservas recurrentes" }]);
    dayOfWeek = data.dayOfWeek;
    assertSemesterWorkingDay(semester, dayOfWeek);
  } else {
    if (!data.date) throw ApiErrors.validation([{ field: "date", message: "date es obligatorio para reservas puntuales" }]);
    date = utcStartOfDay(data.date);
    assertDateWithinSemester(semester, date);
    dayOfWeek = dayOfWeekFromDate(date);
    assertSemesterWorkingDay(semester, dayOfWeek);
  }

  const created = await prisma.$transaction(async tx => {
    await assertClassroomBookable(tx, data.classroomId);
    const slot = {
      classroomId: data.classroomId,
      semesterId: data.semesterId,
      timeSlotId: data.timeSlotId,
    };

    if (data.type === "RECURRENTE") {
      await assertRecurringSlotAvailable(tx, { ...slot, dayOfWeek: dayOfWeek! });
    } else {
      await assertPunctualSlotAvailable(tx, { ...slot, date: date! });
    }

    return tx.reservation.create({
      data: {
        classroomId: data.classroomId,
        semesterId: data.semesterId,
        type: data.type,
        dayOfWeek: data.type === "RECURRENTE" ? dayOfWeek : null,
        date,
        timeSlotId: data.timeSlotId,
        status: "PENDIENTE",
        note: data.note?.trim() || null,
        requestedById: userId,
      },
      include: RESERVATION_INCLUDE,
    });
  }, TX_OPTIONS);

  return toReservation(created);
}

interface UpdateReservationData {
  classroomId?: string;
  timeSlotId?: string;
  dayOfWeek?: number;
  date?: Date;
  note?: string | null;
}

export async function updateReservation(
  id: string,
  data: UpdateReservationData,
  user: { role: UserRole; id: string }
): Promise<Reservation> {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Reserva no encontrada");

  assertCanEdit(existing, user);

  const classroomId = data.classroomId ?? existing.classroomId;
  const timeSlotId = data.timeSlotId ?? existing.timeSlotId;
  let dayOfWeek = existing.dayOfWeek;
  let date = existing.date;

  if (existing.type === "RECURRENTE" && data.dayOfWeek !== undefined) dayOfWeek = data.dayOfWeek;
  if (existing.type === "PUNTUAL" && data.date !== undefined) date = utcStartOfDay(data.date);

  const slotChanged =
    classroomId !== existing.classroomId ||
    timeSlotId !== existing.timeSlotId ||
    dayOfWeek !== existing.dayOfWeek ||
    (date?.getTime() ?? null) !== (existing.date?.getTime() ?? null);

  if (slotChanged || data.timeSlotId) await assertTimeSlotExists(prisma, timeSlotId);

  if (slotChanged) {
    const semester = await loadSemesterOrThrow(prisma, existing.semesterId);
    assertSemesterWorkingDay(semester, dayOfWeek);
    if (existing.type === "PUNTUAL" && date) assertDateWithinSemester(semester, date);
  }

  const updated = await prisma.$transaction(async tx => {
    if (slotChanged) {
      await assertClassroomBookable(tx, classroomId);
      const slot = { classroomId, semesterId: existing.semesterId, timeSlotId };

      if (existing.type === "RECURRENTE") {
        await assertRecurringSlotAvailable(
          tx,
          { ...slot, dayOfWeek: dayOfWeek! },
          { excludeReservationId: id }
        );
      } else {
        await assertPunctualSlotAvailable(
          tx,
          { ...slot, date: date! },
          { excludeReservationId: id }
        );
      }
    }

    return tx.reservation.update({
      where: { id },
      data: {
        ...(data.note !== undefined ? { note: data.note?.trim() || null } : {}),
        classroomId,
        timeSlotId,
        dayOfWeek,
        date,
      },
      include: RESERVATION_INCLUDE,
    });
  }, TX_OPTIONS);

  return toReservation(updated);
}

/**
 * Transiciones de estado permitidas:
 * - ENCARGADO: PENDIENTE -> CONFIRMADA | CANCELADA; CONFIRMADA -> CANCELADA.
 * - AYUDANTE (dueño): PENDIENTE -> CANCELADA.
 * CANCELADA es un estado terminal.
 */
export async function updateReservationStatus(
  id: string,
  targetStatus: Extract<ReservationStatus, "CONFIRMADA" | "CANCELADA">,
  user: { role: UserRole; id: string }
): Promise<Reservation> {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Reserva no encontrada");
  if (existing.status === "CANCELADA") throw ApiErrors.invalidReservationTransition();

  if (user.role === "ENCARGADO") {
    if (targetStatus === "CONFIRMADA" && existing.status !== "PENDIENTE") {
      throw ApiErrors.invalidReservationTransition();
    }
  } else {
    const isOwnerCancel =
      existing.requestedById === user.id &&
      existing.status === "PENDIENTE" &&
      targetStatus === "CANCELADA";
    if (!isOwnerCancel) throw ApiErrors.forbidden();
  }

  const updated = await prisma.$transaction(async tx => {
    // Al confirmar se revalida la disponibilidad: pudo surgir un conflicto
    // entre la creación de la reserva y su confirmación.
    if (targetStatus === "CONFIRMADA") {
      await assertClassroomBookable(tx, existing.classroomId);
      const slot = {
        classroomId: existing.classroomId,
        semesterId: existing.semesterId,
        timeSlotId: existing.timeSlotId,
      };
      if (existing.type === "RECURRENTE") {
        await assertRecurringSlotAvailable(
          tx,
          { ...slot, dayOfWeek: existing.dayOfWeek! },
          { excludeReservationId: id }
        );
      } else {
        await assertPunctualSlotAvailable(
          tx,
          { ...slot, date: existing.date! },
          { excludeReservationId: id }
        );
      }
    }

    return tx.reservation.update({
      where: { id },
      data: {
        status: targetStatus,
        resolvedById: user.id,
      },
      include: RESERVATION_INCLUDE,
    });
  }, TX_OPTIONS);

  return toReservation(updated);
}

function assertCanEdit(
  reservation: { status: ReservationStatus; requestedById: string },
  user: { role: UserRole; id: string }
): void {
  if (user.role === "ENCARGADO") {
    if (reservation.status === "CANCELADA") throw ApiErrors.reservationNotEditable();
    return;
  }
  if (reservation.requestedById !== user.id) throw ApiErrors.forbidden();
  if (reservation.status !== "PENDIENTE") throw ApiErrors.reservationNotEditable();
}

/// Borrado físico de reservas canceladas (limpieza administrativa).
/// Las reservas activas deben gestionarse mediante la cancelación lógica.
export async function deleteReservation(id: string): Promise<void> {
  const existing = await prisma.reservation.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) throw ApiErrors.notFound("Reserva no encontrada");
  if (existing.status !== "CANCELADA") throw ApiErrors.invalidReservationTransition();

  await prisma.reservation.delete({ where: { id } });
}

type ReservationWithRelations = Prisma.ReservationGetPayload<{ include: typeof RESERVATION_INCLUDE }>;

export function toReservation(r: ReservationWithRelations): Reservation {
  return {
    id: r.id,
    classroomId: r.classroomId,
    classroom: r.classroom,
    semesterId: r.semesterId,
    type: r.type,
    dayOfWeek: r.dayOfWeek,
    date: r.date ? r.date.toISOString() : null,
    timeSlotId: r.timeSlotId,
    timeSlot: {
      id: r.timeSlot.id,
      label: r.timeSlot.label,
      startTime: r.timeSlot.startTime,
      endTime: r.timeSlot.endTime,
      order: r.timeSlot.order,
    },
    status: r.status,
    note: r.note,
    requestedById: r.requestedById,
    requestedBy: r.requestedBy,
    resolvedById: r.resolvedById,
    resolvedBy: r.resolvedBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
