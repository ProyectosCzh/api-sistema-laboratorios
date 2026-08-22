import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import type { Classroom, ClassroomStatus, ClassroomType } from "../types";

export async function listClassrooms(includeInactive: boolean, status?: ClassroomStatus): Promise<Classroom[]> {
  const where: { status?: ClassroomStatus | { not: ClassroomStatus } } = {};
  if (status && !(status === "INACTIVA" && !includeInactive)) {
    where.status = status;
  } else if (!includeInactive) {
    where.status = { not: "INACTIVA" };
  }

  const classrooms = await prisma.classroom.findMany({
    where,
    orderBy: { code: "asc" },
  });
  return classrooms.map(toClassroom);
}

export async function createClassroom(data: {
  code: string;
  name: string;
  type: ClassroomType;
  capacity?: number | null;
  location?: string | null;
}): Promise<Classroom> {
  const classroom = await prisma.classroom.create({
    data: {
      code: data.code.toUpperCase().trim(),
      name: data.name.trim(),
      type: data.type,
      capacity: data.capacity ?? null,
      location: data.location?.trim() || null,
      status: "ACTIVA",
    },
  });
  return toClassroom(classroom);
}

export async function updateClassroom(
  id: string,
  data: {
    code?: string;
    name?: string;
    type?: ClassroomType;
    status?: ClassroomStatus;
    capacity?: number | null;
    location?: string | null;
  }
): Promise<Classroom> {
  const updateData: Partial<typeof data> = {};
  if (data.code !== undefined) updateData.code = data.code.toUpperCase().trim();
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.location !== undefined) updateData.location = data.location?.trim() || null;

  const classroom = await prisma.classroom.update({ where: { id }, data: updateData });
  return toClassroom(classroom);
}

export async function setClassroomStatus(id: string, status: ClassroomStatus): Promise<Classroom> {
  const classroom = await prisma.classroom.findUnique({ where: { id }, select: { id: true } });
  if (!classroom) throw ApiErrors.notFound("Aula no encontrada");
  const updated = await prisma.classroom.update({ where: { id }, data: { status } });
  return toClassroom(updated);
}

export async function deleteClassroom(id: string): Promise<void> {
  await prisma.classroom.update({ where: { id }, data: { status: "INACTIVA" } });
}

type ClassroomRecord = {
  id: string;
  code: string;
  name: string;
  type: ClassroomType;
  capacity: number | null;
  location: string | null;
  status: ClassroomStatus;
  createdAt: Date;
  updatedAt: Date;
};

function toClassroom(c: ClassroomRecord): Classroom {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
