import { prisma } from "../lib/prisma";
import { isUniqueViolationOn } from "../utils/dbErrors";
import { ApiErrors } from "../utils/errors";
import type { Subject } from "../types";

export async function listSubjects(includeInactive: boolean): Promise<Subject[]> {
  const subjects = await prisma.subject.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { code: "asc" },
  });
  return subjects.map(toSubject);
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
    return toSubject(subject);
  } catch (e) {
    if (isUniqueViolationOn(e, ["code"])) throw ApiErrors.subjectCodeInUse();
    throw e;
  }
}

export async function updateSubject(id: string, data: { name?: string; active?: boolean }): Promise<Subject> {
  const updateData: { name?: string; active?: boolean } = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.active !== undefined) updateData.active = data.active;

  const subject = await prisma.subject.update({ where: { id }, data: updateData });
  return toSubject(subject);
}

export async function deleteSubject(id: string): Promise<void> {
  await prisma.subject.update({ where: { id }, data: { active: false } });
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
