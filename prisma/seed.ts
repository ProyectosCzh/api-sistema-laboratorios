import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  TIME_SLOTS,
  CLASSROOMS,
  SEMESTER,
  ADMIN,
  AYUDANTES,
  TEACHERS,
  SUBJECTS,
  BLOCKS,
} from "./seed.config";

const prisma = new PrismaClient();

interface ValidatedBlock {
  classroomId: string;
  subjectId: string;
  teacherId: string | null;
  dayOfWeek: number;
  timeSlotId: string;
}

/**
 * Valida el dataset antes de escribir:
 * - referencias existentes (aulas, turnos, materias, docentes)
 * - celdas únicas por aula+semestre+día+turno
 * - sin conflicto de docente (mismo docente en dos aulas, mismo día y turno)
 */
function validateBlocks(lookups: {
  classroomIds: Map<string, string>;
  timeSlotIds: Map<number, string>;
  subjectIds: Map<string, string>;
  teacherIds: Map<string, string>;
}): ValidatedBlock[] {
  const cellKeys = new Set<string>();
  const teacherCells = new Set<string>();
  const validated: ValidatedBlock[] = [];

  for (const b of BLOCKS) {
    const classroomId = lookups.classroomIds.get(b.classroomCode);
    if (!classroomId) throw new Error(`Aula inexistente en bloque: ${b.classroomCode}`);

    const timeSlotId = lookups.timeSlotIds.get(b.timeSlotOrder);
    if (!timeSlotId) throw new Error(`Turno inexistente en bloque: orden ${b.timeSlotOrder}`);

    const subjectId = lookups.subjectIds.get(b.subjectCode);
    if (!subjectId) throw new Error(`Materia inexistente en bloque: ${b.subjectCode}`);

    let teacherId: string | null = null;
    if (b.teacherCode) {
      teacherId = lookups.teacherIds.get(b.teacherCode) ?? null;
      if (!teacherId) throw new Error(`Docente inexistente en bloque: ${b.teacherCode}`);
    }

    const cellKey = `${b.classroomCode}|${b.dayOfWeek}|${b.timeSlotOrder}`;
    if (cellKeys.has(cellKey)) throw new Error(`Bloque duplicado en la misma celda del seed: ${cellKey}`);
    cellKeys.add(cellKey);

    if (teacherId) {
      const teacherCellKey = `${b.teacherCode}|${b.dayOfWeek}|${b.timeSlotOrder}`;
      if (teacherCells.has(teacherCellKey)) {
        throw new Error(`Docente ${b.teacherCode} asignado dos veces el día ${b.dayOfWeek} turno ${b.timeSlotOrder}`);
      }
      teacherCells.add(teacherCellKey);
    }

    validated.push({ classroomId, subjectId, teacherId, dayOfWeek: b.dayOfWeek, timeSlotId });
  }

  return validated;
}

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN.password, 12);

  await prisma.user.upsert({
    where: { id: ADMIN.id },
    update: { name: ADMIN.name, email: ADMIN.email, role: ADMIN.role, passwordHash },
    create: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, passwordHash, role: ADMIN.role },
  });
  console.log(`✔ Usuario: ${ADMIN.email} / ${ADMIN.password} (${ADMIN.role})`);

  for (const user of AYUDANTES) {
    const hash = await bcrypt.hash(user.password, 12);
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, email: user.email, role: user.role, passwordHash: hash },
      create: { id: user.id, name: user.name, email: user.email, passwordHash: hash, role: user.role },
    });
  }
  console.log(`✔ ${AYUDANTES.length} ayudantes cargados`);

  for (const slot of TIME_SLOTS) {
    await prisma.timeSlot.upsert({ where: { id: slot.id }, update: slot, create: slot });
  }
  console.log(`✔ ${TIME_SLOTS.length} turnos cargados`);

  for (const classroom of CLASSROOMS) {
    await prisma.classroom.upsert({ where: { code: classroom.code }, update: { ...classroom }, create: { ...classroom } });
  }
  console.log(`✔ ${CLASSROOMS.length} aulas cargadas`);

  await prisma.semester.upsert({
    where: { id: SEMESTER.id },
    update: { isActive: true, workingDays: SEMESTER.workingDays },
    create: { ...SEMESTER, isActive: true },
  });
  console.log(`✔ Semestre ${SEMESTER.name} activado (días hábiles: ${SEMESTER.workingDays.join(", ")})`);

  for (const teacher of TEACHERS) {
    await prisma.teacher.upsert({ where: { code: teacher.code }, update: { ...teacher }, create: { ...teacher } });
  }
  console.log(`✔ ${TEACHERS.length} docentes cargados`);

  for (const subject of SUBJECTS) {
    await prisma.subject.upsert({ where: { code: subject.code }, update: { ...subject }, create: { ...subject } });
  }
  console.log(`✔ ${SUBJECTS.length} materias cargadas`);

  const [classroomRows, slotRows, subjectRows, teacherRows] = await Promise.all([
    prisma.classroom.findMany({ select: { id: true, code: true } }),
    prisma.timeSlot.findMany({ select: { id: true, order: true } }),
    prisma.subject.findMany({ select: { id: true, code: true } }),
    prisma.teacher.findMany({ select: { id: true, code: true } }),
  ]);

  const validatedBlocks = validateBlocks({
    classroomIds: new Map(classroomRows.map(c => [c.code, c.id])),
    timeSlotIds: new Map(slotRows.map(s => [s.order, s.id])),
    subjectIds: new Map(subjectRows.map(s => [s.code, s.id])),
    teacherIds: new Map(teacherRows.map(t => [t.code, t.id])),
  });
  console.log(`✔ ${validatedBlocks.length} bloques validados (celdas y docentes sin conflictos)`);

  for (const block of validatedBlocks) {
    await prisma.schedule.upsert({
      where: {
        classroomId_semesterId_dayOfWeek_timeSlotId: {
          classroomId: block.classroomId,
          semesterId: SEMESTER.id,
          dayOfWeek: block.dayOfWeek,
          timeSlotId: block.timeSlotId,
        },
      },
      update: { subjectId: block.subjectId, teacherId: block.teacherId },
      create: {
        classroomId: block.classroomId,
        semesterId: SEMESTER.id,
        subjectId: block.subjectId,
        teacherId: block.teacherId,
        dayOfWeek: block.dayOfWeek,
        timeSlotId: block.timeSlotId,
        assignedById: ADMIN.id,
      },
    });
  }
  console.log(`✔ ${validatedBlocks.length} bloques de horario cargados`);

  const [totalClassrooms, totalTeachers, totalSubjects, totalSlots, totalSchedules] = await Promise.all([
    prisma.classroom.count(),
    prisma.teacher.count(),
    prisma.subject.count(),
    prisma.timeSlot.count(),
    prisma.schedule.count({ where: { semesterId: SEMESTER.id } }),
  ]);

  const checks: Array<[string, number, number]> = [
    ["aulas", totalClassrooms, CLASSROOMS.length],
    ["docentes", totalTeachers, TEACHERS.length],
    ["materias", totalSubjects, SUBJECTS.length],
    ["turnos", totalSlots, TIME_SLOTS.length],
    ["bloques del semestre", totalSchedules, BLOCKS.length],
  ];
  for (const [label, actual, expected] of checks) {
    if (actual !== expected) throw new Error(`Verificación fallida: ${label} = ${actual}, esperado ${expected}`);
  }
  console.log(`✔ Verificación OK: ${checks.map(([l, a]) => `${l}=${a}`).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
