import { prisma } from "../lib/prisma";
import type { StatsOverview } from "../types";

export async function getOverview(): Promise<StatsOverview> {
  const [activeSemester, totalClassrooms, classroomsByType, occupancyData, pendingMaintenance] = await Promise.all([
    prisma.semester.findFirst({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.classroom.count({ where: { active: true } }),
    prisma.classroom.groupBy({ by: ["type"], where: { active: true }, _count: { type: true } }),
    getOccupancyData(),
    prisma.maintenanceLog.count({ where: { status: { not: "COMPLETADO" } } }),
  ]);

  return {
    totalClassrooms,
    classroomsByType: classroomsByType.map(c => ({ type: c.type as "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA", count: c._count.type })),
    activeSemester: activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null,
    occupancyByClassroom: occupancyData,
    pendingMaintenance,
  };
}

async function getOccupancyData() {
  const activeSemester = await prisma.semester.findFirst({ where: { isActive: true } });
  if (!activeSemester) {
    const classrooms = await prisma.classroom.findMany({ where: { active: true }, select: { id: true, code: true, name: true } });
    return classrooms.map(c => ({
      classroom: { id: c.id, code: c.code, name: c.name },
      occupiedSlots: 0,
      totalSlots: 54,
      percentage: 0,
    }));
  }

  const schedules = await prisma.schedule.findMany({
    where: { semesterId: activeSemester.id, type: { in: ["CLASE", "ACTIVIDAD"] } },
    select: { classroomId: true },
  });
  const occupiedByClassroom = new Map<string, number>();
  for (const s of schedules) {
    occupiedByClassroom.set(s.classroomId, (occupiedByClassroom.get(s.classroomId) || 0) + 1);
  }

  const classrooms = await prisma.classroom.findMany({ where: { active: true }, select: { id: true, code: true, name: true } });
  return classrooms.map(c => {
    const occupied = occupiedByClassroom.get(c.id) || 0;
    const total = 54;
    const percentage = Math.round((occupied / total) * 10000) / 100;
    return { classroom: { id: c.id, code: c.code, name: c.name }, occupiedSlots: occupied, totalSlots: total, percentage };
  });
}