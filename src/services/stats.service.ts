import { prisma } from "../lib/prisma";
import type { StatsOverview } from "../types";

const DAYS_PER_WEEK = 6;

export async function getOverview(): Promise<StatsOverview> {
  const [activeSemester, totalClassrooms, classroomsByType, timeSlotCount, pendingMaintenance] = await Promise.all([
    prisma.semester.findFirst({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.classroom.count({ where: { status: { not: "INACTIVA" } } }),
    prisma.classroom.groupBy({
      by: ["type"],
      where: { status: { not: "INACTIVA" } },
      _count: { type: true },
    }),
    prisma.timeSlot.count(),
    prisma.maintenanceLog.count({ where: { status: { not: "COMPLETADO" } } }),
  ]);

  const totalSlots = timeSlotCount * DAYS_PER_WEEK;

  return {
    totalClassrooms,
    classroomsByType: classroomsByType.map(c => ({ type: c.type as "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA", count: c._count.type })),
    activeSemester: activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null,
    occupancyByClassroom: await getOccupancyData(activeSemester?.id, totalSlots),
    pendingMaintenance,
  };
}

async function getOccupancyData(activeSemesterId: string | undefined, totalSlots: number) {
  const classrooms = await prisma.classroom.findMany({
    where: { status: { not: "INACTIVA" } },
    select: { id: true, code: true, name: true },
  });

  if (!activeSemesterId) {
    return classrooms.map(c => ({ classroom: c, occupiedSlots: 0, totalSlots, percentage: 0 }));
  }

  const schedules = await prisma.schedule.findMany({
    where: { semesterId: activeSemesterId },
    select: { classroomId: true },
  });
  const occupiedByClassroom = new Map<string, number>();
  for (const s of schedules) {
    occupiedByClassroom.set(s.classroomId, (occupiedByClassroom.get(s.classroomId) || 0) + 1);
  }

  return classrooms.map(c => {
    const occupied = occupiedByClassroom.get(c.id) || 0;
    const percentage = totalSlots > 0 ? Math.round((occupied / totalSlots) * 10000) / 100 : 0;
    return { classroom: c, occupiedSlots: occupied, totalSlots, percentage };
  });
}
