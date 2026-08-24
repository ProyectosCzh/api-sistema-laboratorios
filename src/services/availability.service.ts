import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import type {
  AvailabilityGridCell,
  AvailabilityGridClassroom,
  ClassroomStateResult,
} from "../types";
import {
  ACTIVE_RESERVATION_STATUSES,
  dayOfWeekFromDate,
  utcStartOfDay,
} from "./slotAvailability.service";
import { SCHEDULE_INCLUDE, toSchedule } from "./schedule.service";
import { RESERVATION_INCLUDE, toReservation } from "./reservation.service";

const CLASSROOM_SUMMARY = { select: { id: true, code: true, name: true } } as const;

function parseHHmm(value: string): number {
  const [h = 0, m = 0] = value.split(":").map(Number);
  return h * 60 + m;
}

async function detectCurrentTimeSlot() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  const slots = await prisma.timeSlot.findMany({ orderBy: { order: "asc" } });
  return (
    slots.find(slot => {
      const start = parseHHmm(slot.startTime);
      const end = parseHHmm(slot.endTime);
      return minutes >= start && minutes < end;
    }) ?? null
  );
}

/**
 * Estado de un aula según el documento base (sección 5.4):
 * LIBRE | OCUPADA | MANTENIMIENTO. Por defecto evalúa el día y turno actuales.
 * Convención temporal: la fecha se interpreta como día calendario UTC.
 */
export async function getClassroomState(
  classroomId: string,
  opts: { date?: Date; timeSlotId?: string }
): Promise<ClassroomStateResult> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { ...CLASSROOM_SUMMARY.select, status: true },
  });
  if (!classroom) throw ApiErrors.notFound("Aula no encontrada");

  const date = utcStartOfDay(opts.date ?? new Date());
  const dayOfWeek = dayOfWeekFromDate(date);

  let timeSlot;
  if (opts.timeSlotId) {
    timeSlot = await prisma.timeSlot.findUnique({ where: { id: opts.timeSlotId } });
    if (!timeSlot) throw ApiErrors.notFound("Turno no encontrado");
  } else {
    timeSlot = await detectCurrentTimeSlot();
    if (!timeSlot) {
      throw ApiErrors.validation([
        { field: "timeSlotId", message: "La hora actual está fuera del rango de turnos; indicá un timeSlotId" },
      ]);
    }
  }

  const base = {
    classroomId,
    classroom: { id: classroom.id, code: classroom.code, name: classroom.name },
    date: date.toISOString(),
    dayOfWeek: dayOfWeek ?? 0,
    timeSlotId: timeSlot.id,
  };

  if (dayOfWeek === null) {
    return { ...base, state: "LIBRE", reason: "El domingo no es día hábil" };
  }

  if (classroom.status !== "ACTIVA") {
    const reasons: Record<string, string> = {
      INACTIVA: "El aula está inactiva",
      EN_MANTENIMIENTO: "El aula está en mantenimiento",
      FUERA_SERVICIO: "El aula está fuera de servicio",
    };
    return { ...base, state: "MANTENIMIENTO", reason: reasons[classroom.status] };
  }

  const openMaintenance = await prisma.maintenanceLog.findFirst({
    where: { classroomId, status: { not: "COMPLETADO" } },
    orderBy: { createdAt: "desc" },
  });
  if (openMaintenance) {
    return { ...base, state: "MANTENIMIENTO", reason: "El aula tiene un mantenimiento abierto" };
  }

  // La ocupación se evalúa contra el semestre activo.
  const activeSemester = await prisma.semester.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!activeSemester) {
    return { ...base, state: "LIBRE", reason: "No hay semestre activo" };
  }

  const schedule = await prisma.schedule.findFirst({
    where: {
      classroomId,
      semesterId: activeSemester.id,
      dayOfWeek,
      timeSlotId: timeSlot.id,
    },
    include: SCHEDULE_INCLUDE,
  });
  if (schedule) {
    return { ...base, state: "OCUPADA", occupiedBy: { kind: "SCHEDULE", schedule: toSchedule(schedule) } };
  }

  const recurring = await prisma.reservation.findFirst({
    where: {
      classroomId,
      semesterId: activeSemester.id,
      type: "RECURRENTE",
      dayOfWeek,
      timeSlotId: timeSlot.id,
      status: { in: ACTIVE_RESERVATION_STATUSES },
    },
    include: RESERVATION_INCLUDE,
  });
  if (recurring) {
    return { ...base, state: "OCUPADA", occupiedBy: { kind: "RESERVATION", reservation: toReservation(recurring) } };
  }

  const punctual = await prisma.reservation.findFirst({
    where: {
      classroomId,
      semesterId: activeSemester.id,
      type: "PUNTUAL",
      timeSlotId: timeSlot.id,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      date: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) },
    },
    include: RESERVATION_INCLUDE,
  });
  if (punctual) {
    return { ...base, state: "OCUPADA", occupiedBy: { kind: "RESERVATION", reservation: toReservation(punctual) } };
  }

  return { ...base, state: "LIBRE" };
}

/**
 * Grilla semanal (Tabla Semanal de Disponibilidad): matriz días × turnos
 * por aula con el bloque o reserva que ocupa cada celda.
 */
export async function getAvailabilityGrid(params: {
  semesterId: string;
  classroomId?: string;
  includePuntual?: boolean;
}): Promise<{
  semester: { id: string; name: string; workingDays: number[]; startDate: string; endDate: string };
  timeSlots: Array<{ id: string; label: string; startTime: string; endTime: string; order: number }>;
  classrooms: AvailabilityGridClassroom[];
}> {
  const semester = await prisma.semester.findUnique({
    where: { id: params.semesterId },
    select: { id: true, name: true, workingDays: true, startDate: true, endDate: true },
  });
  if (!semester) throw ApiErrors.notFound("Semestre no encontrado");

  if (params.classroomId) {
    const exists = await prisma.classroom.findUnique({
      where: { id: params.classroomId },
      select: { id: true },
    });
    if (!exists) throw ApiErrors.notFound("Aula no encontrada");
  }

  const [classrooms, timeSlots] = await Promise.all([
    prisma.classroom.findMany({
      where: params.classroomId ? { id: params.classroomId } : { status: { not: "INACTIVA" } },
      select: CLASSROOM_SUMMARY.select,
      orderBy: { code: "asc" },
    }),
    prisma.timeSlot.findMany({ orderBy: { order: "asc" } }),
  ]);

  const classroomIds = classrooms.map(c => c.id);
  const gridClassrooms: AvailabilityGridClassroom[] = [];

  if (classroomIds.length === 0) {
    return {
      semester: {
        id: semester.id,
        name: semester.name,
        workingDays: semester.workingDays,
        startDate: semester.startDate.toISOString(),
        endDate: semester.endDate.toISOString(),
      },
      timeSlots: timeSlots.map(toTimeSlotSummary),
      classrooms: [],
    };
  }

  const [schedules, reservations, maintenances] = await Promise.all([
    prisma.schedule.findMany({
      where: { semesterId: semester.id, classroomId: { in: classroomIds } },
      orderBy: [{ dayOfWeek: "asc" }, { timeSlot: { order: "asc" } }],
      select: {
        id: true,
        classroomId: true,
        dayOfWeek: true,
        timeSlotId: true,
        subject: { select: { id: true, code: true, name: true } },
        teacher: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.reservation.findMany({
      where: {
        semesterId: semester.id,
        classroomId: { in: classroomIds },
        status: { in: ACTIVE_RESERVATION_STATUSES },
        ...(params.includePuntual === false ? { type: "RECURRENTE" as const } : {}),
      },
      select: {
        id: true,
        classroomId: true,
        type: true,
        status: true,
        dayOfWeek: true,
        date: true,
        timeSlotId: true,
      },
    }),
    prisma.maintenanceLog.findMany({
      where: {
        classroomId: { in: classroomIds },
        date: { gte: semester.startDate, lte: semester.endDate },
      },
      select: { id: true, classroomId: true, date: true, reason: true, status: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const schedulesByClassroom = groupBy(schedules, s => s.classroomId);
  const reservationsByClassroom = groupBy(reservations, r => r.classroomId);
  const maintenanceByClassroom = groupBy(maintenances, m => m.classroomId);

  for (const classroom of classrooms) {
    const cells: AvailabilityGridCell[] = [];
    const cellIndex = new Map<string, AvailabilityGridCell>();

    for (const day of [...semester.workingDays].sort((a, b) => a - b)) {
      for (const slot of timeSlots) {
        const cell: AvailabilityGridCell = {
          dayOfWeek: day,
          timeSlotId: slot.id,
          entry: null,
        };
        cells.push(cell);
        cellIndex.set(`${day}|${slot.id}`, cell);
      }
    }

    for (const s of schedulesByClassroom.get(classroom.id) ?? []) {
      const cell = cellIndex.get(`${s.dayOfWeek}|${s.timeSlotId}`);
      if (!cell) continue;
      cell.entry = {
        kind: "SCHEDULE",
        scheduleId: s.id,
        subject: s.subject,
        teacher: s.teacher,
      };
    }

    for (const r of reservationsByClassroom.get(classroom.id) ?? []) {
      const key =
        r.type === "RECURRENTE"
          ? `${r.dayOfWeek}|${r.timeSlotId}`
          : `${r.date ? dayOfWeekFromDate(r.date) : null}|${r.timeSlotId}`;
      const cell = key ? cellIndex.get(key) : undefined;
      if (!cell || cell.entry) continue;
      cell.entry = {
        kind: "RESERVATION",
        reservationId: r.id,
        type: r.type,
        status: r.status,
        date: r.date ? r.date.toISOString() : null,
      };
    }

    gridClassrooms.push({
      classroom,
      maintenance: (maintenanceByClassroom.get(classroom.id) ?? []).map(m => ({
        id: m.id,
        date: m.date.toISOString(),
        reason: m.reason,
        status: m.status,
      })),
      cells,
    });
  }

  return {
    semester: {
      id: semester.id,
      name: semester.name,
      workingDays: semester.workingDays,
      startDate: semester.startDate.toISOString(),
      endDate: semester.endDate.toISOString(),
    },
    timeSlots: timeSlots.map(toTimeSlotSummary),
    classrooms: gridClassrooms,
  };
}

function toTimeSlotSummary(s: { id: string; label: string; startTime: string; endTime: string; order: number }) {
  return { id: s.id, label: s.label, startTime: s.startTime, endTime: s.endTime, order: s.order };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}
