import { prisma } from "../lib/prisma";
import { isUniqueViolationOn } from "../utils/dbErrors";
import { ApiErrors } from "../utils/errors";
import { buildMeta, buildPagination, PaginatedResult } from "../utils/pagination";
import type { CourseOffering, CourseOfferingSummary, CourseOfferingType } from "../types";

const OFFERING_INCLUDE = {
  subject: { select: { id: true, code: true, name: true } },
  teacher: { select: { id: true, code: true, name: true } },
} as const;

export interface ListOfferingsOptions {
  semesterId?: string;
  subjectId?: string;
  teacherId?: string;
  includeInactive?: boolean;
  page: number;
  pageSize: number;
}

export async function listOfferings(filters: ListOfferingsOptions): Promise<PaginatedResult<CourseOffering>> {
  const { page, pageSize, ...whereFilters } = filters;
  const { skip, take } = buildPagination(page, pageSize);

  const where: Record<string, unknown> = {};
  if (whereFilters.semesterId) where.semesterId = whereFilters.semesterId;
  if (whereFilters.subjectId) where.subjectId = whereFilters.subjectId;
  if (whereFilters.teacherId) where.teacherId = whereFilters.teacherId;
  if (!whereFilters.includeInactive) where.active = true;

  const [offerings, total] = await Promise.all([
    prisma.courseOffering.findMany({
      where,
      include: OFFERING_INCLUDE,
      orderBy: [{ subject: { code: "asc" } }, { section: "asc" }],
      skip,
      take,
    }),
    prisma.courseOffering.count({ where }),
  ]);

  return { items: offerings.map(toOffering), meta: buildMeta(total, page, pageSize) };
}

export async function getOffering(id: string): Promise<CourseOffering> {
  const offering = await prisma.courseOffering.findUnique({ where: { id }, include: OFFERING_INCLUDE });
  if (!offering) throw ApiErrors.notFound("Comisión no encontrada");
  return toOffering(offering);
}

export async function createOffering(data: {
  semesterId: string;
  subjectId: string;
  teacherId?: string | null;
  section: string;
  type?: CourseOfferingType;
  note?: string | null;
}): Promise<CourseOffering> {
  const [semester, subject] = await Promise.all([
    prisma.semester.findUnique({ where: { id: data.semesterId } }),
    prisma.subject.findUnique({ where: { id: data.subjectId } }),
  ]);
  if (!semester) throw ApiErrors.notFound("Semestre no encontrado");
  if (!subject) throw ApiErrors.notFound("Materia no encontrada");
  if (!subject.active) throw ApiErrors.inactiveCatalogItem("La materia está inactiva y no puede usarse en comisiones nuevas");

  const teacherId = data.teacherId ?? null;
  const section = normalizeSection(data.section);
  await assertOfferingNotDuplicate({ semesterId: data.semesterId, subjectId: data.subjectId, section, teacherId });

  if (teacherId) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw ApiErrors.notFound("Docente no encontrado");
    if (!teacher.active) throw ApiErrors.inactiveCatalogItem("El docente está inactivo y no puede asignarse a comisiones nuevas");
  }

  try {
    const offering = await prisma.courseOffering.create({
      data: {
        semesterId: data.semesterId,
        subjectId: data.subjectId,
        teacherId,
        section,
        type: data.type ?? "CLASE",
        note: data.note?.trim() || null,
      },
      include: OFFERING_INCLUDE,
    });
    return toOffering(offering);
  } catch (e) {
    if (isUniqueViolationOn(e, ["semesterId", "subjectId", "section", "teacherId"])) throw ApiErrors.offeringAlreadyExists();
    throw e;
  }
}

async function assertOfferingNotDuplicate(key: {
  semesterId: string;
  subjectId: string;
  section: string;
  teacherId: string | null;
}, excludeId?: string): Promise<void> {
  const duplicate = await prisma.courseOffering.findFirst({
    where: { ...key, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (duplicate) throw ApiErrors.offeringAlreadyExists();
}

export async function updateOffering(
  id: string,
  data: {
    teacherId?: string | null;
    section?: string;
    type?: CourseOfferingType;
    active?: boolean;
    note?: string | null;
  }
): Promise<CourseOffering> {
  const existing = await prisma.courseOffering.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Comisión no encontrada");

  const updateData: {
    teacherId?: string | null;
    section?: string;
    type?: CourseOfferingType;
    active?: boolean;
    note?: string | null;
  } = {};
  if (data.section !== undefined) updateData.section = normalizeSection(data.section);
  if (data.type !== undefined) updateData.type = data.type;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.note !== undefined) updateData.note = data.note?.trim() || null;

  if (data.teacherId !== undefined && data.teacherId !== null) {
    const teacher = await prisma.teacher.findUnique({ where: { id: data.teacherId } });
    if (!teacher) throw ApiErrors.notFound("Docente no encontrado");
    if (!teacher.active) throw ApiErrors.inactiveCatalogItem("El docente está inactivo y no puede asignarse a comisiones");
    updateData.teacherId = data.teacherId;
  } else if (data.teacherId === null) {
    updateData.teacherId = null;
  }

  if (updateData.section !== undefined || updateData.teacherId !== undefined) {
    await assertOfferingNotDuplicate(
      {
        semesterId: existing.semesterId,
        subjectId: existing.subjectId,
        section: updateData.section ?? existing.section,
        teacherId: updateData.teacherId !== undefined ? updateData.teacherId : existing.teacherId,
      },
      id
    );
  }

  try {
    const offering = await prisma.courseOffering.update({
      where: { id },
      data: updateData,
      include: OFFERING_INCLUDE,
    });
    return toOffering(offering);
  } catch (e) {
    if (isUniqueViolationOn(e, ["semesterId", "subjectId", "section", "teacherId"])) throw ApiErrors.offeringAlreadyExists();
    throw e;
  }
}

export async function deleteOffering(id: string): Promise<void> {
  await prisma.courseOffering.update({ where: { id }, data: { active: false } });
}

function normalizeSection(section: string): string {
  return section.trim().toUpperCase();
}

type OfferingRecord = {
  id: string;
  semesterId: string;
  section: string;
  type: CourseOfferingType;
  note: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  subject: { id: string; code: string; name: string };
  teacher: { id: string; code: string; name: string } | null;
};

export function toOfferingSummary(o: OfferingRecord): CourseOfferingSummary {
  return {
    id: o.id,
    semesterId: o.semesterId,
    section: o.section,
    type: o.type,
    subject: o.subject,
    teacher: o.teacher,
  };
}

function toOffering(o: OfferingRecord): CourseOffering {
  return {
    ...toOfferingSummary(o),
    note: o.note,
    active: o.active,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}