import { prisma } from "../lib/prisma";
import type { Classroom } from "../types";

export async function listClassrooms(includeInactive: boolean): Promise<Classroom[]> {
  const classrooms = await prisma.classroom.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { code: "asc" },
  });
  return classrooms.map(toClassroom);
}

export async function createClassroom(data: { code: string; name: string; type: "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA"; capacity?: number | null; location?: string | null }): Promise<Classroom> {
  const classroom = await prisma.classroom.create({
    data: { code: data.code.toUpperCase().trim(), name: data.name.trim(), type: data.type, capacity: data.capacity ?? null, location: data.location?.trim() || null },
  });
  return toClassroom(classroom);
}

export async function updateClassroom(id: string, data: { code?: string; name?: string; type?: "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA"; capacity?: number | null; location?: string | null }): Promise<Classroom> {
  const updateData: typeof data = {};
  if (data.code !== undefined) updateData.code = data.code.toUpperCase().trim();
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.type !== undefined) updateData.type = data.type;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.location !== undefined) updateData.location = data.location?.trim() || null;

  const classroom = await prisma.classroom.update({ where: { id }, data: updateData });
  return toClassroom(classroom);
}

export async function deleteClassroom(id: string): Promise<Classroom> {
  const classroom = await prisma.classroom.update({ where: { id }, data: { active: false } });
  return toClassroom(classroom);
}

function toClassroom(c: { id: string; code: string; name: string; type: "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA"; capacity: number | null; location: string | null; active: boolean; createdAt: Date; updatedAt: Date }): Classroom {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}