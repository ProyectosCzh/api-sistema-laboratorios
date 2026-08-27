import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { cache } from "../cache";
import { CACHE_KEYS, CACHE_POLICIES } from "../cache/policies";
import { invalidateCatalog, invalidateStats } from "../cache/invalidate";
import { ApiErrors } from "../utils/errors";
import { buildMeta, buildPagination, PaginatedResult } from "../utils/pagination";
import type { Classroom, ClassroomStatus, ClassroomType } from "../types";

export interface ListClassroomsOptions {
  includeInactive: boolean;
  status?: ClassroomStatus;
  q?: string;
  page: number;
  pageSize: number;
}

export async function listClassrooms(opts: ListClassroomsOptions): Promise<PaginatedResult<Classroom>> {
  return cache.getOrSet(
    CACHE_KEYS.classroomsList(opts),
    async () => {
      const { skip, take } = buildPagination(opts.page, opts.pageSize);

      const where: Prisma.ClassroomWhereInput = {};
      if (opts.includeInactive && opts.status) {
        where.status = opts.status;
      } else if (!opts.includeInactive) {
        where.status = { notIn: ["INACTIVA", "FUERA_SERVICIO"] };
      }
      if (opts.q) {
        where.OR = [
          { code: { contains: opts.q, mode: "insensitive" } },
          { name: { contains: opts.q, mode: "insensitive" } },
        ];
      }

      const [classrooms, total] = await Promise.all([
        prisma.classroom.findMany({ where, orderBy: { code: "asc" }, skip, take }),
        prisma.classroom.count({ where }),
      ]);

      return { items: classrooms.map(toClassroom), meta: buildMeta(total, opts.page, opts.pageSize) };
    },
    CACHE_POLICIES.classrooms
  );
}

export async function getClassroom(id: string): Promise<Classroom> {
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom) throw ApiErrors.notFound("Aula no encontrada");
  return toClassroom(classroom);
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
  invalidateCatalog();
  invalidateStats();
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
): Promise<{ classroom: Classroom; warnings: string[] }> {
  const warnings: string[] = [];

  if (
    data.status !== undefined &&
    (data.status === "INACTIVA" || data.status === "FUERA_SERVICIO")
  ) {
    const activeSemester = await prisma.semester.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    if (activeSemester) {
      const [scheduleCount, reservationCount] = await Promise.all([
        prisma.schedule.count({
          where: { classroomId: id, semesterId: activeSemester.id },
        }),
        prisma.reservation.count({
          where: {
            classroomId: id,
            semesterId: activeSemester.id,
            status: { notIn: ["CANCELADA"] },
          },
        }),
      ]);

      if (scheduleCount > 0) {
        warnings.push(
          `El aula tiene ${scheduleCount} horario(s) activo(s) en el semestre "${activeSemester.name}"`
        );
      }
      if (reservationCount > 0) {
        warnings.push(
          `El aula tiene ${reservationCount} reserva(s) activa(s) en el semestre "${activeSemester.name}"`
        );
      }
    }
  }

  const updateData: Partial<typeof data> = {};
  if (data.code !== undefined) updateData.code = data.code.toUpperCase().trim();
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.location !== undefined) updateData.location = data.location?.trim() || null;

  const classroom = await prisma.classroom.update({ where: { id }, data: updateData });
  invalidateCatalog();
  invalidateStats();
  return { classroom: toClassroom(classroom), warnings };
}

export async function deleteClassroom(id: string): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];

  const activeSemester = await prisma.semester.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  if (activeSemester) {
    const [scheduleCount, reservationCount] = await Promise.all([
      prisma.schedule.count({
        where: { classroomId: id, semesterId: activeSemester.id },
      }),
      prisma.reservation.count({
        where: {
          classroomId: id,
          semesterId: activeSemester.id,
          status: { notIn: ["CANCELADA"] },
        },
      }),
    ]);

    if (scheduleCount > 0) {
      warnings.push(
        `El aula tiene ${scheduleCount} horario(s) activo(s) en el semestre "${activeSemester.name}"`
      );
    }
    if (reservationCount > 0) {
      warnings.push(
        `El aula tiene ${reservationCount} reserva(s) activa(s) en el semestre "${activeSemester.name}"`
      );
    }
  }

  await prisma.classroom.update({ where: { id }, data: { status: "INACTIVA" } });
  invalidateCatalog();
  invalidateStats();
  return { warnings };
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
