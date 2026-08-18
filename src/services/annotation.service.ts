import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import type { Annotation } from "../types";

export async function listAnnotations(classroomId: string, from?: Date, to?: Date): Promise<Annotation[]> {
  const annotations = await prisma.annotation.findMany({
    where: {
      classroomId,
      ...(from || to ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });
  return annotations.map(toAnnotation);
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