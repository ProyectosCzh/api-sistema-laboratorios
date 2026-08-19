import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import type { Schedule, ScheduleType } from "../types";

const SCHEDULE_INCLUDE = {
  timeSlot: true,
  assignedBy: { select: { id: true, name: true } },
} as const;

async function hasActiveSemester(): Promise<boolean> {
  const active = await prisma.semester.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  return active !== null;
}

export async function listSchedules(classroomId: string, semesterId: string): Promise<Schedule[]> {
  const schedules = await prisma.schedule.findMany({
    where: { classroomId, semesterId },
    include: SCHEDULE_INCLUDE,
    orderBy: [{ dayOfWeek: "asc" }, { timeSlot: { order: "asc" } }],
  });
  return schedules.map(toSchedule);
}

export async function createSchedule(data: {
  classroomId: string;
  semesterId: string;
  dayOfWeek: number;
  timeSlotId: string;
  type: ScheduleType;
  title: string;
  teacher?: string | null;
  note?: string | null;
}, userId: string, userRole: "ENCARGADO" | "AYUDANTE"): Promise<Schedule> {
  if (data.type === "MANTENIMIENTO" && userRole === "AYUDANTE") throw ApiErrors.forbidden();

  const [classroom, semester, timeSlot] = await Promise.all([
    prisma.classroom.findUnique({ where: { id: data.classroomId } }),
    prisma.semester.findUnique({ where: { id: data.semesterId } }),
    prisma.timeSlot.findUnique({ where: { id: data.timeSlotId } }),
  ]);
  if (!classroom) throw ApiErrors.notFound("Aula no encontrada");
  if (!semester) throw ApiErrors.notFound("Semestre no encontrado");
  if (!timeSlot) throw ApiErrors.notFound("Turno no encontrado");

  if (!(await hasActiveSemester())) throw ApiErrors.noActiveSemester();

  const schedule = await prisma.schedule.create({
    data: { ...data, assignedById: userId },
    include: SCHEDULE_INCLUDE,
  });
  return toSchedule(schedule);
}

export async function updateSchedule(
  id: string,
  data: {
    classroomId?: string;
    semesterId?: string;
    dayOfWeek?: number;
    timeSlotId?: string;
    type?: ScheduleType;
    title?: string;
    teacher?: string | null;
    note?: string | null;
  },
  userId: string,
  userRole: "ENCARGADO" | "AYUDANTE"
): Promise<Schedule> {
  const existing = await prisma.schedule.findUnique({ where: { id }, include: { assignedBy: { select: { id: true } } } });
  if (!existing) throw ApiErrors.notFound("Horario no encontrado");

  const isAuthor = existing.assignedById === userId;
  if (userRole === "AYUDANTE") {
    if (!isAuthor) throw ApiErrors.forbidden();
    if (existing.type === "MANTENIMIENTO") throw ApiErrors.forbidden();
    if (data.type === "MANTENIMIENTO") throw ApiErrors.forbidden();
  }

  const classroomId = data.classroomId ?? existing.classroomId;
  const semesterId = data.semesterId ?? existing.semesterId;
  const dayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
  const timeSlotId = data.timeSlotId ?? existing.timeSlotId;

  const cellChanged = classroomId !== existing.classroomId || semesterId !== existing.semesterId || dayOfWeek !== existing.dayOfWeek || timeSlotId !== existing.timeSlotId;
  if (cellChanged) {
    const [classroom, semester, timeSlot] = await Promise.all([
      prisma.classroom.findUnique({ where: { id: classroomId } }),
      prisma.semester.findUnique({ where: { id: semesterId } }),
      prisma.timeSlot.findUnique({ where: { id: timeSlotId } }),
    ]);
    if (!classroom) throw ApiErrors.notFound("Aula no encontrada");
    if (!semester) throw ApiErrors.notFound("Semestre no encontrado");
    if (!timeSlot) throw ApiErrors.notFound("Turno no encontrado");

    if (semesterId !== existing.semesterId) {
      if (!(await hasActiveSemester())) throw ApiErrors.noActiveSemester();
    }
    const conflict = await prisma.schedule.findFirst({
      where: { classroomId, semesterId, dayOfWeek, timeSlotId, NOT: { id } },
    });
    if (conflict) throw ApiErrors.reservationConflict();
  }

  const schedule = await prisma.schedule.update({
    where: { id },
    data: { ...data, title: data.title ?? existing.title },
    include: SCHEDULE_INCLUDE,
  });
  return toSchedule(schedule);
}

export async function deleteSchedule(id: string, userId: string, userRole: "ENCARGADO" | "AYUDANTE"): Promise<void> {
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Horario no encontrado");

  const isAuthor = existing.assignedById === userId;
  if (userRole === "AYUDANTE") {
    if (!isAuthor) throw ApiErrors.forbidden();
    if (existing.type === "MANTENIMIENTO") throw ApiErrors.forbidden();
  }

  await prisma.schedule.delete({ where: { id } });
}

function toSchedule(s: {
  id: string;
  classroomId: string;
  semesterId: string;
  dayOfWeek: number;
  timeSlotId: string;
  timeSlot: { id: string; label: string; startTime: string; endTime: string; order: number };
  type: ScheduleType;
  title: string;
  teacher: string | null;
  note: string | null;
  assignedById: string;
  assignedBy: { id: string; name: string };
  updatedAt: Date;
}): Schedule {
  return {
    id: s.id,
    classroomId: s.classroomId,
    semesterId: s.semesterId,
    dayOfWeek: s.dayOfWeek,
    timeSlotId: s.timeSlotId,
    timeSlot: {
      id: s.timeSlot.id,
      label: s.timeSlot.label,
      startTime: s.timeSlot.startTime,
      endTime: s.timeSlot.endTime,
      order: s.timeSlot.order,
    },
    type: s.type,
    title: s.title,
    teacher: s.teacher,
    note: s.note,
    assignedById: s.assignedById,
    assignedBy: s.assignedBy,
    updatedAt: s.updatedAt.toISOString(),
  };
}