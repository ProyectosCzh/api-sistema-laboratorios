import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TIME_SLOTS, CLASSROOMS, SEMESTER, ADMIN } from "./seed.config";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN.password, 12);

  await prisma.user.upsert({
    where: { id: ADMIN.id },
    update: {
      name: ADMIN.name,
      email: ADMIN.email,
      role: ADMIN.role,
      passwordHash,
    },
    create: {
      id: ADMIN.id,
      name: ADMIN.name,
      email: ADMIN.email,
      passwordHash,
      role: ADMIN.role,
    },
  });
  console.log(`✔ Usuario: ${ADMIN.email} / ${ADMIN.password} (${ADMIN.role})`);

  for (const slot of TIME_SLOTS) {
    await prisma.timeSlot.upsert({
      where: { id: slot.id },
      update: slot,
      create: slot,
    });
  }
  console.log(`✔ ${TIME_SLOTS.length} turnos cargados`);

  for (const classroom of CLASSROOMS) {
    await prisma.classroom.upsert({
      where: { id: classroom.id },
      update: { ...classroom },
      create: { ...classroom },
    });
  }
  console.log(`✔ ${CLASSROOMS.length} aulas cargadas`);

  await prisma.semester.upsert({
    where: { id: SEMESTER.id },
    update: { isActive: true },
    create: { ...SEMESTER, isActive: true },
  });
  console.log(`✔ Semestre ${SEMESTER.name} activado`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
