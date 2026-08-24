import { prisma } from "../lib/prisma";
import { cache } from "../cache";
import { CACHE_KEYS, CACHE_POLICIES } from "../cache/policies";
import { invalidateCatalog, invalidateStats } from "../cache/invalidate";
import { isUniqueViolationOn } from "../utils/dbErrors";
import { ApiErrors } from "../utils/errors";
import type { TimeSlot } from "../types";
import type { CreateTimeSlotInput, UpdateTimeSlotInput } from "../validators/timeSlot.schema";

export async function listTimeSlots(): Promise<TimeSlot[]> {
  return cache.getOrSet(
    CACHE_KEYS.timeSlotsList,
    async () => {
      const slots = await prisma.timeSlot.findMany({ orderBy: { order: "asc" } });
      return slots.map(toTimeSlot);
    },
    CACHE_POLICIES.timeSlots
  );
}

export async function getTimeSlot(id: string): Promise<TimeSlot> {
  const slot = await prisma.timeSlot.findUnique({ where: { id } });
  if (!slot) throw ApiErrors.notFound("Turno no encontrado");
  return toTimeSlot(slot);
}

export async function createTimeSlot(data: CreateTimeSlotInput): Promise<TimeSlot> {
  try {
    const slot = await prisma.timeSlot.create({ data });
    invalidateCatalog();
    invalidateStats();
    return toTimeSlot(slot);
  } catch (e) {
    if (isUniqueViolationOn(e, ["order"])) throw ApiErrors.timeSlotOrderInUse();
    throw e;
  }
}

export async function updateTimeSlot(id: string, data: UpdateTimeSlotInput): Promise<TimeSlot> {
  const existing = await prisma.timeSlot.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw ApiErrors.notFound("Turno no encontrado");

  const updateData: { label?: string; startTime?: string; endTime?: string; order?: number } = {};
  if (data.label !== undefined) updateData.label = data.label;
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.endTime !== undefined) updateData.endTime = data.endTime;
  if (data.order !== undefined) updateData.order = data.order;

  try {
    const slot = await prisma.timeSlot.update({ where: { id }, data: updateData });
    invalidateCatalog();
    invalidateStats();
    return toTimeSlot(slot);
  } catch (e) {
    if (isUniqueViolationOn(e, ["order"])) throw ApiErrors.timeSlotOrderInUse();
    throw e;
  }
}

export async function deleteTimeSlot(id: string): Promise<void> {
  const existing = await prisma.timeSlot.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw ApiErrors.notFound("Turno no encontrado");

  const schedulesCount = await prisma.schedule.count({ where: { timeSlotId: id } });
  if (schedulesCount > 0) throw ApiErrors.timeSlotInUse();

  await prisma.timeSlot.delete({ where: { id } });
  invalidateCatalog();
  invalidateStats();
}

function toTimeSlot(t: { id: string; label: string; startTime: string; endTime: string; order: number }): TimeSlot {
  return { id: t.id, label: t.label, startTime: t.startTime, endTime: t.endTime, order: t.order };
}
