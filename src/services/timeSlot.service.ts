import { prisma } from "../lib/prisma";
import type { TimeSlot } from "../types";

export async function listTimeSlots(): Promise<TimeSlot[]> {
  const slots = await prisma.timeSlot.findMany({ orderBy: { order: "asc" } });
  return slots.map(toTimeSlot);
}

function toTimeSlot(t: { id: string; label: string; startTime: string; endTime: string; order: number }): TimeSlot {
  return { id: t.id, label: t.label, startTime: t.startTime, endTime: t.endTime, order: t.order };
}