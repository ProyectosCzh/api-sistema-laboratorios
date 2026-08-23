import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { uniqueViolationColumns } from "../utils/dbErrors";
import { ApiErrors } from "../utils/errors";
import type { Schedule } from "../types";
import { toOfferingSummary } from "./courseOffering.service";

const SCHEDULE_INCLUDE = {
  timeSlot: true,
  classroom: { select: { id: true, code: true, name: true } },
  courseOffering: {
    include: {
      subject: { select: { id: true, code: true, name: true } },
      teacher: { select: { id: true, code: true, name: true } },
    },
  },
  assignedBy: { select: { id: true, name: true } },
} as const;

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

type TxClient = Prisma.TransactionClient;

type OfferingWithRelations = {
  id: string;
  semesterId: string;
  active: boolean;
  subjectId: string;
  teacherId: string | null;
  section: string;
  type: "CLASE" | "EXTRACURRICULAR" | "ACTIVIDAD";
  note: string | null;
  subject: { id: string; code: string; name: string; active: boolean };
  teacher: { id: string; code: string; name: string; active: boolean } | null;
};

async function hasActiveSemester(): Promise<boolean> {
  const active = await prisma.semester.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  return active !== null;
}

async function assertClassroomAvailable(tx: TxClient, classroomId: string): Promise<void> {
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

async function loadValidOffering(tx: TxClient, offeringId: string, semesterId: string): Promise<OfferingWithRelations> {
  const offering = await tx.courseOffering.findUnique({
    where: { id: offeringId },
    include: {
      subject: { select: { id: true, code: true, name: true, active: true } },
      teacher: { select: { id: true, code: true, name: true, active: true } },
    },
  });
  if (!offering) throw ApiErrors.notFound("Comisión no encontrada");
  if (!offering.active) throw ApiErrors.inactiveCatalogItem("La comisión está inactiva y no puede usarse en horarios nuevos");
  if (!offering.subject.active) throw ApiErrors.inactiveCatalogItem("La materia de la comisión está inactiva");
  if (offering.teacherId && offering.teacher && !offering.teacher.active) {
    throw ApiErrors.inactiveCatalogItem("El docente de la comisión está inactivo");
  }
  if (offering.semesterId !== semesterId) throw ApiErrors.semesterMismatch();
  return offering as OfferingWithRelations;
}

async function assertTimeSlotExists(timeSlotId: string): Promise<void> {
  const timeSlot = await prisma.timeSlot.findUnique({ where: { id: timeSlotId }, select: { id: true } });
  if (!timeSlot) throw ApiErrors.notFound("Turno no encontrado");
}

async function assertNoTeacherConflict(
  tx: TxClient,
  offering: OfferingWithRelations,
  slot: { dayOfWeek: number; timeSlotId: string },
  excludeScheduleId?: string
): Promise<void> {
  if (!offering.teacherId) return;
  const conflict = await tx.schedule.findFirst({
    where: {
      ...(excludeScheduleId ? { NOT: { id: excludeScheduleId } } : {}),
      semesterId: offering.semesterId,
      dayOfWeek: slot.dayOfWeek,
      timeSlotId: slot.timeSlotId,
      courseOffering: { teacherId: offering.teacherId },
    },
    select: { id: true },
  });
  if (conflict) throw ApiErrors.teacherConflict();
}

function mapUniqueViolation(e: unknown): never | void {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return;
  const columns = uniqueViolationColumns(e);
  if (columns?.includes("courseOfferingId")) throw ApiErrors.offeringConflict();
  throw ApiErrors.reservationConflict();
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

export async function createSchedule(data: {
  classroomId: string;
  semesterId: string;
  courseOfferingId: string;
  dayOfWeek: number;
  timeSlotId: string;
  note?: string | null;
}, userId: string): Promise<Schedule> {
  await assertTimeSlotExists(data.timeSlotId);
  if (!(await hasActiveSemester())) throw ApiErrors.noActiveSemester();

  const created = await prisma.$transaction(async tx => {
    await assertClassroomAvailable(tx, data.classroomId);
    const offering = await loadValidOffering(tx, data.courseOfferingId, data.semesterId);
    await assertNoTeacherConflict(tx, offering, { dayOfWeek: data.dayOfWeek, timeSlotId: data.timeSlotId });

    try {
      return await tx.schedule.create({
        data: {
          classroomId: data.classroomId,
          semesterId: data.semesterId,
          courseOfferingId: data.courseOfferingId,
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
  data: {
    classroomId?: string;
    semesterId?: string;
    courseOfferingId?: string;
    dayOfWeek?: number;
    timeSlotId?: string;
    note?: string | null;
  },
  userId: string,
  userRole: "ENCARGADO" | "AYUDANTE"
): Promise<Schedule> {
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Horario no encontrado");

  if (userRole === "AYUDANTE" && existing.assignedById !== userId) throw ApiErrors.forbidden();

  if (data.timeSlotId) await assertTimeSlotExists(data.timeSlotId);

  const classroomId = data.classroomId ?? existing.classroomId;
  const semesterId = data.semesterId ?? existing.semesterId;
  const courseOfferingId = data.courseOfferingId ?? existing.courseOfferingId;
  const dayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
  const timeSlotId = data.timeSlotId ?? existing.timeSlotId;

  const cellChanged =
    classroomId !== existing.classroomId ||
    semesterId !== existing.semesterId ||
    courseOfferingId !== existing.courseOfferingId ||
    dayOfWeek !== existing.dayOfWeek ||
    timeSlotId !== existing.timeSlotId;

  if (cellChanged && semesterId === existing.semesterId && !(await hasActiveSemester())) {
    throw ApiErrors.noActiveSemester();
  }

  const updated = await prisma.$transaction(async tx => {
    if (cellChanged) {
      await assertClassroomAvailable(tx, classroomId);
      const offering = await loadValidOffering(tx, courseOfferingId, semesterId);
      await assertNoTeacherConflict(tx, offering, { dayOfWeek, timeSlotId }, id);

      const sameCell = await tx.schedule.findFirst({
        where: { classroomId, semesterId, dayOfWeek, timeSlotId, NOT: { id } },
        select: { id: true },
      });
      if (sameCell) throw ApiErrors.reservationConflict();
    }

    try {
      return await tx.schedule.update({
        where: { id },
        data: {
          ...(data.note !== undefined ? { note: data.note?.trim() || null } : {}),
          classroomId,
          semesterId,
          courseOfferingId,
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

export async function deleteSchedule(id: string, userId: string, userRole: "ENCARGADO" | "AYUDANTE"): Promise<void> {
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Horario no encontrado");

  if (userRole === "AYUDANTE" && existing.assignedById !== userId) throw ApiErrors.forbidden();

  await prisma.schedule.delete({ where: { id } });
}

type ScheduleWithRelations = Prisma.ScheduleGetPayload<{ include: typeof SCHEDULE_INCLUDE }>;

function toSchedule(s: ScheduleWithRelations): Schedule {
  return {
    id: s.id,
    classroomId: s.classroomId,
    classroom: s.classroom,
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
    courseOfferingId: s.courseOfferingId,
    courseOffering: toOfferingSummary(s.courseOffering),
    note: s.note,
    assignedById: s.assignedById,
    assignedBy: s.assignedBy,
    updatedAt: s.updatedAt.toISOString(),
  };
}