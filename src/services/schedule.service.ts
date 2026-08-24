import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { uniqueViolationColumns } from "../utils/dbErrors";
import { ApiErrors } from "../utils/errors";
import type { Schedule } from "../types";
import {
  TX_OPTIONS,
  assertClassroomBookable,
  assertNoTeacherConflict,
  assertRecurringSlotAvailable,
  assertSemesterWorkingDay,
  assertTimeSlotExists,
  loadActiveSubject,
  loadActiveTeacher,
  loadSemesterOrThrow,
} from "./slotAvailability.service";

export const SCHEDULE_INCLUDE = {
  timeSlot: true,
  classroom: { select: { id: true, code: true, name: true } },
  subject: { select: { id: true, code: true, name: true } },
  teacher: { select: { id: true, code: true, name: true } },
  assignedBy: { select: { id: true, name: true } },
} as const;

export interface CreateScheduleData {
  classroomId: string;
  semesterId: string;
  subjectId: string;
  teacherId?: string | null;
  dayOfWeek: number;
  timeSlotId: string;
  note?: string | null;
}

export interface UpdateScheduleData {
  classroomId?: string;
  semesterId?: string;
  subjectId?: string;
  teacherId?: string | null;
  dayOfWeek?: number;
  timeSlotId?: string;
  note?: string | null;
}

type Role = "ENCARGADO" | "AYUDANTE";

function mapUniqueViolation(e: unknown): void {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return;
  const columns = uniqueViolationColumns(e);
  if (columns?.includes("timeSlotId")) throw ApiErrors.reservationConflict();
}

export async function listSchedules(classroomId: string, semesterId: string): Promise<Schedule[]> {
  const schedules = await prisma.schedule.findMany({
    where: { classroomId, semesterId },
    include: SCHEDULE_INCLUDE,
    orderBy: [{ dayOfWeek: "asc" }, { timeSlot: { order: "asc" } }],
  });
  return schedules.map(toSchedule);
}

export async function getSchedule(id: string): Promise<Schedule> {
  const schedule = await prisma.schedule.findUnique({ where: { id }, include: SCHEDULE_INCLUDE });
  if (!schedule) throw ApiErrors.notFound("Horario no encontrado");
  return toSchedule(schedule);
}

export async function createSchedule(data: CreateScheduleData, userId: string): Promise<Schedule> {
  await assertTimeSlotExists(prisma, data.timeSlotId);

  const created = await prisma.$transaction(async tx => {
    await assertClassroomBookable(tx, data.classroomId);
    const semester = await loadSemesterOrThrow(tx, data.semesterId);
    assertSemesterWorkingDay(semester, data.dayOfWeek);

    await loadActiveSubject(tx, data.subjectId);
    if (data.teacherId) await loadActiveTeacher(tx, data.teacherId);

    await assertRecurringSlotAvailable(tx, {
      classroomId: data.classroomId,
      semesterId: data.semesterId,
      dayOfWeek: data.dayOfWeek,
      timeSlotId: data.timeSlotId,
    });
    await assertNoTeacherConflict(tx, data.teacherId ?? null, {
      semesterId: data.semesterId,
      dayOfWeek: data.dayOfWeek,
      timeSlotId: data.timeSlotId,
    });

    try {
      return await tx.schedule.create({
        data: {
          classroomId: data.classroomId,
          semesterId: data.semesterId,
          subjectId: data.subjectId,
          teacherId: data.teacherId ?? null,
          dayOfWeek: data.dayOfWeek,
          timeSlotId: data.timeSlotId,
          note: data.note?.trim() || null,
          assignedById: userId,
        },
        include: SCHEDULE_INCLUDE,
      });
    } catch (e) {
      mapUniqueViolation(e);
      throw e;
    }
  }, TX_OPTIONS);

  return toSchedule(created);
}

export async function updateSchedule(
  id: string,
  data: UpdateScheduleData,
  userId: string,
  userRole: Role
): Promise<Schedule> {
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Horario no encontrado");

  if (userRole === "AYUDANTE" && existing.assignedById !== userId) throw ApiErrors.forbidden();

  const classroomId = data.classroomId ?? existing.classroomId;
  const semesterId = data.semesterId ?? existing.semesterId;
  const subjectId = data.subjectId ?? existing.subjectId;
  const dayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
  const timeSlotId = data.timeSlotId ?? existing.timeSlotId;

  let teacherId = existing.teacherId;
  if (data.teacherId !== undefined) teacherId = data.teacherId;

  const cellChanged =
    classroomId !== existing.classroomId ||
    semesterId !== existing.semesterId ||
    dayOfWeek !== existing.dayOfWeek ||
    timeSlotId !== existing.timeSlotId;
  const staffingChanged =
    subjectId !== existing.subjectId ||
    (teacherId ?? null) !== (existing.teacherId ?? null);

  if (cellChanged || data.timeSlotId) await assertTimeSlotExists(prisma, timeSlotId);

  const updated = await prisma.$transaction(async tx => {
    if (cellChanged) {
      await assertClassroomBookable(tx, classroomId);
      const semester = await loadSemesterOrThrow(tx, semesterId);
      assertSemesterWorkingDay(semester, dayOfWeek);
    }

    if (staffingChanged || cellChanged) {
      if (subjectId !== existing.subjectId) await loadActiveSubject(tx, subjectId);
      if (teacherId && teacherId !== existing.teacherId) await loadActiveTeacher(tx, teacherId);

      await assertRecurringSlotAvailable(
        tx,
        { classroomId, semesterId, dayOfWeek, timeSlotId },
        { excludeScheduleId: id }
      );
      await assertNoTeacherConflict(
        tx,
        teacherId ?? null,
        { semesterId, dayOfWeek, timeSlotId },
        id
      );
    }

    try {
      return await tx.schedule.update({
        where: { id },
        data: {
          ...(data.note !== undefined ? { note: data.note?.trim() || null } : {}),
          classroomId,
          semesterId,
          subjectId,
          teacherId: teacherId ?? null,
          dayOfWeek,
          timeSlotId,
        },
        include: SCHEDULE_INCLUDE,
      });
    } catch (e) {
      mapUniqueViolation(e);
      throw e;
    }
  }, TX_OPTIONS);

  return toSchedule(updated);
}

export async function deleteSchedule(id: string, userId: string, userRole: Role): Promise<void> {
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Horario no encontrado");

  if (userRole === "AYUDANTE" && existing.assignedById !== userId) throw ApiErrors.forbidden();

  await prisma.schedule.delete({ where: { id } });
}

type ScheduleWithRelations = Prisma.ScheduleGetPayload<{ include: typeof SCHEDULE_INCLUDE }>;

export function toSchedule(s: ScheduleWithRelations): Schedule {
  return {
    id: s.id,
    classroomId: s.classroomId,
    classroom: s.classroom,
    semesterId: s.semesterId,
    subjectId: s.subjectId,
    subject: s.subject,
    teacherId: s.teacherId,
    teacher: s.teacher,
    dayOfWeek: s.dayOfWeek,
    timeSlotId: s.timeSlotId,
    timeSlot: {
      id: s.timeSlot.id,
      label: s.timeSlot.label,
      startTime: s.timeSlot.startTime,
      endTime: s.timeSlot.endTime,
      order: s.timeSlot.order,
    },
    note: s.note,
    assignedById: s.assignedById,
    assignedBy: s.assignedBy,
    updatedAt: s.updatedAt.toISOString(),
  };
}
