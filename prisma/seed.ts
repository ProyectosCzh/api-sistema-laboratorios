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

function offeringSlug(subjectCode: string, section: string, teacherCode?: string): string {
  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const parts = ["off", subjectCode, section];
  if (teacherCode) parts.push(teacherCode);
  return parts.map(sanitize).join("-");
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
    update: { isActive: true },
    create: { ...SEMESTER, isActive: true },
  });
  console.log(`✔ Semestre ${SEMESTER.name} activado`);

  for (const teacher of TEACHERS) {
    await prisma.teacher.upsert({ where: { code: teacher.code }, update: { ...teacher }, create: { ...teacher } });
  }
  console.log(`✔ ${TEACHERS.length} docentes cargados`);

  for (const { type: _subjectType, ...subject } of SUBJECTS) {
    await prisma.subject.upsert({ where: { code: subject.code }, update: { ...subject }, create: { ...subject } });
  }
  console.log(`✔ ${SUBJECTS.length} materias cargadas`);

  const subjectByCode = new Map(SUBJECTS.map(s => [s.code, s]));
  const teacherByCode = new Map(TEACHERS.map(t => [t.code, t]));
  const classroomByCode = new Map(CLASSROOMS.map(c => [c.code, c]));
  const slotByOrder = new Map(TIME_SLOTS.map(t => [t.order, t]));

  for (const b of BLOCKS) {
    if (!classroomByCode.has(b.classroomCode)) throw new Error(`Aula inexistente en bloque: ${b.classroomCode}`);
    if (!slotByOrder.has(b.timeSlotOrder)) throw new Error(`Turno inexistente en bloque: ${b.timeSlotOrder}`);
    if (!subjectByCode.has(b.subjectCode)) throw new Error(`Materia inexistente en bloque: ${b.subjectCode}`);
    if (b.teacherCode && !teacherByCode.has(b.teacherCode)) throw new Error(`Docente inexistente en bloque: ${b.teacherCode}`);
  }

  const cellKeys = new Set(BLOCKS.map(b => `${b.classroomCode}|${b.dayOfWeek}|${b.timeSlotOrder}`));
  if (cellKeys.size !== BLOCKS.length) throw new Error("Bloques duplicados en la misma celda del seed");

  interface OfferingDerived {
    id: string;
    semesterId: string;
    subjectId: string;
    teacherId: string | null;
    section: string;
    type: string;
  }

  const offerings = new Map<string, OfferingDerived>();
  for (const b of BLOCKS) {
    const subject = subjectByCode.get(b.subjectCode)!;
    const teacher = b.teacherCode ? teacherByCode.get(b.teacherCode)! : null;
    const key = `${b.subjectCode}|${b.section}|${teacher?.code ?? ""}`;
    if (!offerings.has(key)) {
      offerings.set(key, {
        id: offeringSlug(b.subjectCode, b.section, teacher?.code),
        semesterId: SEMESTER.id,
        subjectId: subject.id,
        teacherId: teacher?.id ?? null,
        section: b.section.toUpperCase(),
        type: subject.type,
      });
    }
  }

  for (const o of offerings.values()) {
    const existing = await prisma.courseOffering.findFirst({
      where: { semesterId: o.semesterId, subjectId: o.subjectId, section: o.section, teacherId: o.teacherId },
      select: { id: true },
    });
    if (existing) {
      await prisma.courseOffering.update({ where: { id: existing.id }, data: { ...o, active: true } });
    } else {
      await prisma.courseOffering.create({ data: o });
    }
  }
  console.log(`✔ ${offerings.size} comisiones cargadas`);

  const offeringByKey = new Map<string, OfferingDerived>();
  for (const [key, o] of offerings.entries()) offeringByKey.set(key, o);

  let createdBlocks = 0;
  for (const b of BLOCKS) {
    const classroom = classroomByCode.get(b.classroomCode)!;
    const slot = slotByOrder.get(b.timeSlotOrder)!;
    const teacher = b.teacherCode ? teacherByCode.get(b.teacherCode)! : null;
    const offering = offeringByKey.get(`${b.subjectCode}|${b.section}|${teacher?.code ?? ""}`)!;

    await prisma.schedule.upsert({
      where: {
        classroomId_semesterId_dayOfWeek_timeSlotId: {
          classroomId: classroom.id,
          semesterId: SEMESTER.id,
          dayOfWeek: b.dayOfWeek,
          timeSlotId: slot.id,
        },
      },
      update: { courseOfferingId: offering.id },
      create: {
        classroomId: classroom.id,
        semesterId: SEMESTER.id,
        courseOfferingId: offering.id,
        dayOfWeek: b.dayOfWeek,
        timeSlotId: slot.id,
        assignedById: ADMIN.id,
      },
    });
    createdBlocks++;
  }
  console.log(`✔ ${createdBlocks} bloques de horario cargados`);

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
