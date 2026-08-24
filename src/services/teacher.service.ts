import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { cache } from "../cache";
import { CACHE_KEYS, CACHE_POLICIES } from "../cache/policies";
import { invalidateCatalog } from "../cache/invalidate";
import { isUniqueViolationOn } from "../utils/dbErrors";
import { ApiErrors } from "../utils/errors";
import { buildMeta, buildPagination, PaginatedResult } from "../utils/pagination";
import type { Teacher } from "../types";

export interface ListTeachersOptions {
  includeInactive: boolean;
  q?: string;
  page: number;
  pageSize: number;
}

export async function listTeachers(opts: ListTeachersOptions): Promise<PaginatedResult<Teacher>> {
  return cache.getOrSet(
    CACHE_KEYS.teachersList(opts),
    async () => {
      const { skip, take } = buildPagination(opts.page, opts.pageSize);

      const where: Prisma.TeacherWhereInput = {
        ...(opts.includeInactive ? {} : { active: true }),
        ...(opts.q
          ? {
              OR: [
                { code: { contains: opts.q, mode: "insensitive" } },
                { name: { contains: opts.q, mode: "insensitive" } },
                { email: { contains: opts.q, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [teachers, total] = await Promise.all([
        prisma.teacher.findMany({ where, orderBy: { name: "asc" }, skip, take }),
        prisma.teacher.count({ where }),
      ]);

      return { items: teachers.map(toTeacher), meta: buildMeta(total, opts.page, opts.pageSize) };
    },
    CACHE_POLICIES.teachers
  );
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
    invalidateCatalog();
    return toTeacher(teacher);
  } catch (e) {
    if (isUniqueViolationOn(e, ["code"])) throw ApiErrors.teacherCodeInUse();
    if (isUniqueViolationOn(e, ["email"])) throw ApiErrors.teacherEmailInUse();
    throw e;
  }
}

export async function updateTeacher(
  id: string,
  data: { code?: string; name?: string; email?: string | null; active?: boolean }
): Promise<Teacher> {
  const updateData: { code?: string; name?: string; email?: string | null; active?: boolean } = {};
  if (data.code !== undefined) updateData.code = data.code.toUpperCase().trim();
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = normalizeEmail(data.email);
  if (data.active !== undefined) updateData.active = data.active;

  try {
    const teacher = await prisma.teacher.update({ where: { id }, data: updateData });
    invalidateCatalog();
    return toTeacher(teacher);
  } catch (e) {
    if (isUniqueViolationOn(e, ["code"])) throw ApiErrors.teacherCodeInUse();
    if (isUniqueViolationOn(e, ["email"])) throw ApiErrors.teacherEmailInUse();
    throw e;
  }
}

export async function deleteTeacher(id: string): Promise<void> {
  await prisma.teacher.update({ where: { id }, data: { active: false } });
  invalidateCatalog();
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