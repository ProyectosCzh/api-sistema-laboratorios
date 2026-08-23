import { prisma } from "../lib/prisma";
import type { ListSemestersQuery } from "../validators/semester.schema";
import { ApiErrors } from "../utils/errors";
import { buildMeta, buildPagination, PaginatedResult } from "../utils/pagination";
import type { Semester } from "../types";

export async function listSemesters(query: ListSemestersQuery): Promise<PaginatedResult<Semester>> {
  const { page, pageSize } = query;
  const { skip, take } = buildPagination(page, pageSize);

  const [semesters, total] = await Promise.all([
    prisma.semester.findMany({ orderBy: { startDate: "desc" }, skip, take }),
    prisma.semester.count(),
  ]);

  return { items: semesters.map(toSemester), meta: buildMeta(total, page, pageSize) };
}

export async function getSemester(id: string): Promise<Semester> {
  const semester = await prisma.semester.findUnique({ where: { id } });
  if (!semester) throw ApiErrors.notFound("Semestre no encontrado");
  return toSemester(semester);
}

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];

function normalizeWorkingDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

export async function createSemester(data: {
  name: string;
  startDate: Date;
  endDate: Date;
  workingDays?: number[];
}): Promise<Semester> {
  if (data.endDate <= data.startDate) throw ApiErrors.validation([{ field: "endDate", message: "endDate debe ser posterior a startDate" }]);
  const semester = await prisma.semester.create({
    data: {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      workingDays: normalizeWorkingDays(data.workingDays ?? DEFAULT_WORKING_DAYS),
      isActive: false,
    },
  });
  return toSemester(semester);
}

export async function updateSemester(
  id: string,
  data: { name?: string; startDate?: Date; endDate?: Date; workingDays?: number[] }
): Promise<Semester> {
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    throw ApiErrors.validation([{ field: "endDate", message: "endDate debe ser posterior a startDate" }]);
  }
  const updateData = { ...data };
  if (data.workingDays !== undefined) updateData.workingDays = normalizeWorkingDays(data.workingDays);
  const semester = await prisma.semester.update({ where: { id }, data: updateData });
  return toSemester(semester);
}

export async function activateSemester(id: string): Promise<Semester> {
  await prisma.$transaction([
    prisma.semester.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.semester.update({ where: { id }, data: { isActive: true } }),
  ]);
  const semester = await prisma.semester.findUniqueOrThrow({ where: { id } });
  return toSemester(semester);
}

export async function deleteSemester(id: string): Promise<void> {
  const semester = await prisma.semester.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!semester) throw ApiErrors.notFound("Semestre no encontrado");
  if (semester.isActive) throw ApiErrors.semesterActive();

  const [reservationsCount, schedulesCount] = await Promise.all([
    prisma.reservation.count({ where: { semesterId: id } }),
    prisma.schedule.count({ where: { semesterId: id } }),
  ]);
  if (reservationsCount > 0 || schedulesCount > 0) throw ApiErrors.semesterHasDependencies();

  await prisma.semester.delete({ where: { id } });
}

function toSemester(s: {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  workingDays: number[];
  isActive: boolean;
}): Semester {
  return {
    id: s.id,
    name: s.name,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    workingDays: s.workingDays,
    isActive: s.isActive,
  };
}
