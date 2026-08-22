-- DropIndex
DROP INDEX "CourseOffering_semesterId_subjectId_section_key";

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_semesterId_subjectId_section_teacherId_key" ON "CourseOffering"("semesterId", "subjectId", "section", "teacherId");