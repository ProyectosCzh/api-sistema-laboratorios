import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import { buildMeta, buildPagination, PaginatedResult } from "../utils/pagination";
import type { Annotation } from "../types";
import type { UpdateAnnotationInput } from "../validators/annotation.schema";

export interface ListAnnotationsOptions {
  classroomId: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export async function listAnnotations(opts: ListAnnotationsOptions): Promise<PaginatedResult<Annotation>> {
  const { skip, take } = buildPagination(opts.page, opts.pageSize);

  const where: Prisma.AnnotationWhereInput = {
    classroomId: opts.classroomId,
    ...(opts.from || opts.to
      ? {
          date: {
            ...(opts.from && { gte: opts.from }),
            ...(opts.to && { lt: nextDay(opts.to) }),
          },
        }
      : {}),
  };

  const [annotations, total] = await Promise.all([
    prisma.annotation.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
    prisma.annotation.count({ where }),
  ]);

  return { items: annotations.map(toAnnotation), meta: buildMeta(total, opts.page, opts.pageSize) };
}

function nextDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

export async function getAnnotation(id: string): Promise<Annotation> {
  const annotation = await prisma.annotation.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!annotation) throw ApiErrors.notFound("Anotación no encontrada");
  return toAnnotation(annotation);
}

export async function createAnnotation(classroomId: string, content: string, userId: string): Promise<Annotation> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) throw ApiErrors.notFound("Aula no encontrada");

  const annotation = await prisma.annotation.create({
    data: { classroomId, content, userId },
    include: { user: { select: { id: true, name: true } } },
  });
  return toAnnotation(annotation);
}

export async function updateAnnotation(id: string, data: UpdateAnnotationInput, userId: string, userRole: "ENCARGADO" | "AYUDANTE"): Promise<Annotation> {
  const existing = await prisma.annotation.findUnique({ where: { id } });
  if (!existing) throw ApiErrors.notFound("Anotación no encontrada");

  if (userRole === "AYUDANTE" && existing.userId !== userId) throw ApiErrors.forbidden();

  const annotation = await prisma.annotation.update({
    where: { id },
    data: { content: data.content },
    include: { user: { select: { id: true, name: true } } },
  });
  return toAnnotation(annotation);
}

export async function deleteAnnotation(id: string, userId: string, userRole: "ENCARGADO" | "AYUDANTE"): Promise<void> {
  const annotation = await prisma.annotation.findUnique({ where: { id } });
  if (!annotation) throw ApiErrors.notFound("Anotación no encontrada");

  if (userRole === "AYUDANTE" && annotation.userId !== userId) throw ApiErrors.forbidden();

  await prisma.annotation.delete({ where: { id } });
}

function toAnnotation(a: {
  id: string;
  classroomId: string;
  userId: string;
  user: { id: string; name: string };
  date: Date;
  content: string;
}): Annotation {
  return {
    id: a.id,
    classroomId: a.classroomId,
    userId: a.userId,
    user: a.user,
    date: a.date.toISOString(),
    content: a.content,
  };
}