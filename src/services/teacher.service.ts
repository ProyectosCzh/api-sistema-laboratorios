import { prisma } from "../lib/prisma";
import { isUniqueViolationOn } from "../utils/dbErrors";
import { ApiErrors } from "../utils/errors";
import type { Teacher } from "../types";

export async function listTeachers(includeInactive: boolean): Promise<Teacher[]> {
  const teachers = await prisma.teacher.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
  return teachers.map(toTeacher);
}

export async function getTeacher(id: string): Promise<Teacher> {
  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) throw ApiErrors.notFound("Docente no encontrado");
  return toTeacher(teacher);
}

export async function createTeacher(data: { code: string; name: string; email?: string | null }): Promise<Teacher> {
  try {
    const teacher = await prisma.teacher.create({
      data: {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        email: normalizeEmail(data.email),
      },
    });
    return toTeacher(teacher);
  } catch (e) {
    if (isUniqueViolationOn(e, ["code"])) throw ApiErrors.teacherCodeInUse();
    if (isUniqueViolationOn(e, ["email"])) throw ApiErrors.teacherEmailInUse();
    throw e;
  }
}

export async function updateTeacher(
  id: string,
  data: { name?: string; email?: string | null; active?: boolean }
): Promise<Teacher> {
  const updateData: { name?: string; email?: string | null; active?: boolean } = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = normalizeEmail(data.email);
  if (data.active !== undefined) updateData.active = data.active;

  try {
    const teacher = await prisma.teacher.update({ where: { id }, data: updateData });
    return toTeacher(teacher);
  } catch (e) {
    if (isUniqueViolationOn(e, ["email"])) throw ApiErrors.teacherEmailInUse();
    throw e;
  }
}

export async function deleteTeacher(id: string): Promise<void> {
  await prisma.teacher.update({ where: { id }, data: { active: false } });
}

function normalizeEmail(email?: string | null): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

type TeacherRecord = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toTeacher(t: TeacherRecord): Teacher {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    email: t.email,
    active: t.active,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
