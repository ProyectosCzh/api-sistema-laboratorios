import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { cache } from "../cache";
import { CACHE_KEYS, CACHE_POLICIES } from "../cache/policies";
import { invalidateCatalog } from "../cache/invalidate";
import { isUniqueViolationOn } from "../utils/dbErrors";
import { ApiErrors } from "../utils/errors";
import { buildMeta, buildPagination, PaginatedResult } from "../utils/pagination";
import type { Subject } from "../types";

export interface ListSubjectsOptions {
  includeInactive: boolean;
  q?: string;
  page: number;
  pageSize: number;
}

export async function listSubjects(opts: ListSubjectsOptions): Promise<PaginatedResult<Subject>> {
  return cache.getOrSet(
    CACHE_KEYS.subjectsList(opts),
    async () => {
      const { skip, take } = buildPagination(opts.page, opts.pageSize);

      const where: Prisma.SubjectWhereInput = {
        ...(opts.includeInactive ? {} : { active: true }),
        ...(opts.q
          ? {
              OR: [
                { code: { contains: opts.q, mode: "insensitive" } },
                { name: { contains: opts.q, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [subjects, total] = await Promise.all([
        prisma.subject.findMany({ where, orderBy: { code: "asc" }, skip, take }),
        prisma.subject.count({ where }),
      ]);

      return { items: subjects.map(toSubject), meta: buildMeta(total, opts.page, opts.pageSize) };
    },
    CACHE_POLICIES.subjects
  );
}

export async function getSubject(id: string): Promise<Subject> {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) throw ApiErrors.notFound("Materia no encontrada");
  return toSubject(subject);
}

export async function createSubject(data: { code: string; name: string }): Promise<Subject> {
  try {
    const subject = await prisma.subject.create({
      data: { code: data.code.toUpperCase().trim(), name: data.name.trim() },
    });
    invalidateCatalog();
    return toSubject(subject);
  } catch (e) {
    if (isUniqueViolationOn(e, ["code"])) throw ApiErrors.subjectCodeInUse();
    throw e;
  }
}

export async function updateSubject(id: string, data: { code?: string; name?: string; active?: boolean }): Promise<Subject> {
  const updateData: { code?: string; name?: string; active?: boolean } = {};
  if (data.code !== undefined) updateData.code = data.code.toUpperCase().trim();
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.active !== undefined) updateData.active = data.active;

  try {
    const subject = await prisma.subject.update({ where: { id }, data: updateData });
    invalidateCatalog();
    return toSubject(subject);
  } catch (e) {
    if (isUniqueViolationOn(e, ["code"])) throw ApiErrors.subjectCodeInUse();
    throw e;
  }
}

export async function deleteSubject(id: string): Promise<void> {
  await prisma.subject.update({ where: { id }, data: { active: false } });
  invalidateCatalog();
}

type SubjectRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toSubject(s: SubjectRecord): Subject {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    active: s.active,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
