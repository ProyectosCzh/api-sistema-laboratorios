-- CreateEnum
CREATE TYPE "ClassroomStatus" AS ENUM ('ACTIVA', 'INACTIVA', 'EN_MANTENIMIENTO', 'FUERA_SERVICIO');

-- CreateEnum
CREATE TYPE "CourseOfferingType" AS ENUM ('CLASE', 'EXTRACURRICULAR', 'ACTIVIDAD');

-- AlterTable
ALTER TABLE "Classroom" DROP COLUMN "active",
ADD COLUMN     "status" "ClassroomStatus" NOT NULL DEFAULT 'ACTIVA';

-- AlterTable
ALTER TABLE "Schedule" DROP COLUMN "teacher",
DROP COLUMN "title",
DROP COLUMN "type",
ADD COLUMN     "courseOfferingId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "ScheduleType";

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "section" TEXT NOT NULL,
    "type" "CourseOfferingType" NOT NULL DEFAULT 'CLASE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_code_key" ON "Teacher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE INDEX "CourseOffering_semesterId_idx" ON "CourseOffering"("semesterId");

-- CreateIndex
CREATE INDEX "CourseOffering_subjectId_idx" ON "CourseOffering"("subjectId");

-- CreateIndex
CREATE INDEX "CourseOffering_teacherId_idx" ON "CourseOffering"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_semesterId_subjectId_section_key" ON "CourseOffering"("semesterId", "subjectId", "section");

-- CreateIndex
CREATE INDEX "MaintenanceLog_classroomId_status_idx" ON "MaintenanceLog"("classroomId", "status");

-- CreateIndex
CREATE INDEX "Schedule_courseOfferingId_idx" ON "Schedule"("courseOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_courseOfferingId_dayOfWeek_timeSlotId_key" ON "Schedule"("courseOfferingId", "dayOfWeek", "timeSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_name_key" ON "Semester"("name");

-- CreateIndex
CREATE INDEX "Semester_isActive_idx" ON "Semester"("isActive");

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddPartialUniqueIndex: solo un semestre activo permitido
CREATE UNIQUE INDEX "semester_single_active" ON "Semester"("isActive") WHERE "isActive";
