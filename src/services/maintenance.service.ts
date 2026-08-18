import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import type { MaintenanceLog, MaintenanceStatus } from "../types";

export async function listMaintenance(classroomId?: string, status?: MaintenanceStatus): Promise<MaintenanceLog[]> {
  const where: Record<string, unknown> = {};
  if (classroomId) where.classroomId = classroomId;
  if (status) where.status = status;

  const logs = await prisma.maintenanceLog.findMany({
    where,
    include: { classroom: { select: { id: true, code: true, name: true } } },
    orderBy: { date: "desc" },
  });
  return logs.map(toMaintenance);
}

export async function createMaintenance(classroomId: string, date: Date, reason: string, userId: string): Promise<MaintenanceLog> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) throw ApiErrors.notFound("Aula no encontrada");

  const normalizedDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const log = await prisma.maintenanceLog.create({
    data: { classroomId, date: normalizedDate, reason, createdById: userId, status: "REPORTADO" },
    include: { classroom: { select: { id: true, code: true, name: true } } },
  });
  return toMaintenance(log);
}

export async function updateMaintenance(id: string, status: MaintenanceStatus): Promise<MaintenanceLog> {
  const log = await prisma.maintenanceLog.update({
    where: { id },
    data: { status },
    include: { classroom: { select: { id: true, code: true, name: true } } },
  });
  return toMaintenance(log);
}

export async function deleteMaintenance(id: string): Promise<void> {
  await prisma.maintenanceLog.delete({ where: { id } });
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