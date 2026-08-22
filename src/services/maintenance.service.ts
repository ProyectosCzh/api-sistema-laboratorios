import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import type { MaintenanceLog, MaintenanceStatus } from "../types";

const CLASSROOM_SELECT = { select: { id: true, code: true, name: true } } as const;
const MAINTENANCE_INCLUDE = { classroom: CLASSROOM_SELECT } as const;
const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

export async function listMaintenance(classroomId?: string, status?: MaintenanceStatus): Promise<MaintenanceLog[]> {
  const where: Record<string, unknown> = {};
  if (classroomId) where.classroomId = classroomId;
  if (status) where.status = status;

  const logs = await prisma.maintenanceLog.findMany({
    where,
    include: MAINTENANCE_INCLUDE,
    orderBy: { date: "desc" },
  });
  return logs.map(toMaintenance);
}

export async function createMaintenance(classroomId: string, date: Date, reason: string, userId: string): Promise<MaintenanceLog> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { id: true } });
  if (!classroom) throw ApiErrors.notFound("Aula no encontrada");

  const normalizedDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const log = await prisma.$transaction(async tx => {
    const created = await tx.maintenanceLog.create({
      data: { classroomId, date: normalizedDate, reason, createdById: userId, status: "REPORTADO" },
      include: MAINTENANCE_INCLUDE,
    });
    await syncClassroomAvailability(tx, classroomId);
    return created;
  }, TX_OPTIONS);

  return toMaintenance(log);
}

export async function updateMaintenance(id: string, status: MaintenanceStatus): Promise<MaintenanceLog> {
  const existing = await prisma.maintenanceLog.findUnique({ where: { id }, select: { id: true, classroomId: true } });
  if (!existing) throw ApiErrors.notFound("Mantenimiento no encontrado");

  const log = await prisma.$transaction(async tx => {
    const updated = await tx.maintenanceLog.update({
      where: { id },
      data: { status },
      include: MAINTENANCE_INCLUDE,
    });
    await syncClassroomAvailability(tx, existing.classroomId);
    return updated;
  }, TX_OPTIONS);

  return toMaintenance(log);
}

export async function deleteMaintenance(id: string): Promise<void> {
  const existing = await prisma.maintenanceLog.findUnique({ where: { id }, select: { id: true, classroomId: true } });
  if (!existing) throw ApiErrors.notFound("Mantenimiento no encontrado");

  await prisma.$transaction(async tx => {
    await tx.maintenanceLog.delete({ where: { id } });
    await syncClassroomAvailability(tx, existing.classroomId);
  }, TX_OPTIONS);
}

async function syncClassroomAvailability(tx: Prisma.TransactionClient, classroomId: string): Promise<void> {
  const [classroom, openCount] = await Promise.all([
    tx.classroom.findUnique({ where: { id: classroomId }, select: { id: true, status: true } }),
    tx.maintenanceLog.count({ where: { classroomId, status: { not: "COMPLETADO" } } }),
  ]);
  if (!classroom) return;

  if (openCount > 0 && classroom.status === "ACTIVA") {
    await tx.classroom.update({ where: { id: classroomId }, data: { status: "EN_MANTENIMIENTO" } });
  }
  if (openCount === 0 && classroom.status === "EN_MANTENIMIENTO") {
    await tx.classroom.update({ where: { id: classroomId }, data: { status: "ACTIVA" } });
  }
}

function toMaintenance(m: {
  id: string;
  classroomId: string;
  classroom: { id: string; code: string; name: string };
  date: Date;
  reason: string;
  status: MaintenanceStatus;
  createdById: string;
  createdAt: Date;
}): MaintenanceLog {
  return {
    id: m.id,
    classroomId: m.classroomId,
    classroom: m.classroom,
    date: m.date.toISOString(),
    reason: m.reason,
    status: m.status,
    createdById: m.createdById,
    createdAt: m.createdAt.toISOString(),
  };
}
