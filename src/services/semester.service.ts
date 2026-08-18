import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import type { Semester } from "../types";

export async function listSemesters(): Promise<Semester[]> {
  const semesters = await prisma.semester.findMany({ orderBy: { startDate: "desc" } });
  return semesters.map(toSemester);
}

export async function createSemester(data: { name: string; startDate: Date; endDate: Date }): Promise<Semester> {
  if (data.endDate <= data.startDate) throw ApiErrors.validation([{ field: "endDate", message: "endDate debe ser posterior a startDate" }]);
  const semester = await prisma.semester.create({ data: { ...data, isActive: false } });
  return toSemester(semester);
}

export async function updateSemester(id: string, data: { name?: string; startDate?: Date; endDate?: Date }): Promise<Semester> {
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    throw ApiErrors.validation([{ field: "endDate", message: "endDate debe ser posterior a startDate" }]);
  }
  const semester = await prisma.semester.update({ where: { id }, data });
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

function toSemester(s: { id: string; name: string; startDate: Date; endDate: Date; isActive: boolean }): Semester {
  return {
    id: s.id,
    name: s.name,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    isActive: s.isActive,
  };
}