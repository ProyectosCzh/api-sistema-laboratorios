import { prisma } from "../lib/prisma";
import { cache } from "../cache";
import { CACHE_KEYS, CACHE_POLICIES } from "../cache/policies";
import type { StatsOverview } from "../types";

const FALLBACK_DAYS_PER_WEEK = 6;

export async function getOverview(): Promise<StatsOverview> {
  return cache.getOrSet(CACHE_KEYS.statsOverview, loadOverview, CACHE_POLICIES.statsOverview);
}

async function loadOverview(): Promise<StatsOverview> {
  const [activeSemester, totalClassrooms, classroomsByType, timeSlotCount, pendingMaintenance, reservationsByStatus] =
    await Promise.all([
      prisma.semester.findFirst({ where: { isActive: true }, select: { id: true, name: true, workingDays: true } }),
      prisma.classroom.count({ where: { status: { not: "INACTIVA" } } }),
      prisma.classroom.groupBy({
        by: ["type"],
        where: { status: { not: "INACTIVA" } },
        _count: { type: true },
      }),
      prisma.timeSlot.count(),
      prisma.maintenanceLog.count({ where: { status: { not: "COMPLETADO" } } }),
      prisma.reservation.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

  const workingDays = activeSemester?.workingDays ?? [];
  const totalSlots = timeSlotCount * (workingDays.length > 0 ? workingDays.length : FALLBACK_DAYS_PER_WEEK);

  return {
    totalClassrooms,
    classroomsByType: classroomsByType.map(c => ({ type: c.type as "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA", count: c._count.type })),
    activeSemester: activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null,
    occupancyByClassroom: await getOccupancyData(activeSemester?.id, totalSlots),
    pendingMaintenance,
    reservationsByStatus: reservationsByStatus.map(r => ({
      status: r.status as "PENDIENTE" | "CONFIRMADA" | "CANCELADA",
      count: r._count.status,
    })),
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

  const grouped = await prisma.schedule.groupBy({
    by: ["classroomId"],
    where: { semesterId: activeSemesterId },
    _count: { _all: true },
  });
  const occupiedByClassroom = new Map(grouped.map(g => [g.classroomId, g._count._all]));

  return classrooms.map(c => {
    const occupied = occupiedByClassroom.get(c.id) || 0;
    const percentage = totalSlots > 0 ? Math.round((occupied / totalSlots) * 10000) / 100 : 0;
    return { classroom: c, occupiedSlots: occupied, totalSlots, percentage };
  });
}
