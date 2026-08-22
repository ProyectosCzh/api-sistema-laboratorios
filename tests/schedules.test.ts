import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  testRequest,
  loginAsAdmin,
  loginAsHelper,
  createTestClassroom,
  createTestSemester,
  activateSemester,
  createTestSubject,
  createTestTeacher,
  createTestOffering,
  cleanupTestUsers,
} from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Schedules (modelo normalizado)", () => {
  let adminToken: string;
  let helperToken: string;
  let testClassroomId: string;
  let otherClassroomId: string;
  let testSemesterId: string;
  let inactiveSemesterId: string;
  let subjectId: string;
  let teacherAId: string;
  let teacherBId: string;

  const cleanupIds = {
    scheduleIds: [] as string[],
    maintenanceIds: [] as string[],
    subjectIds: [] as string[],
    teacherIds: [] as string[],
    offeringIds: [] as string[],
    classroomIds: [] as string[],
    semesterIds: [] as string[],
  };

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
    const helper = await loginAsHelper();
    helperToken = helper.token;

    testClassroomId = (await createTestClassroom(adminToken, `SCH-${Date.now()}`)).id;
    cleanupIds.classroomIds.push(testClassroomId);
    otherClassroomId = (await createTestClassroom(adminToken, `SCH2-${Date.now()}`)).id;
    cleanupIds.classroomIds.push(otherClassroomId);

    testSemesterId = (await createTestSemester(adminToken, `SEM-SCH-${Date.now()}`)).id;
    cleanupIds.semesterIds.push(testSemesterId);
    await activateSemester(adminToken, testSemesterId);

    inactiveSemesterId = (await createTestSemester(adminToken, `SEM-INACT-${Date.now()}`)).id;
    cleanupIds.semesterIds.push(inactiveSemesterId);

    const subject = await createTestSubject(adminToken);
    subjectId = subject.id;
    cleanupIds.subjectIds.push(subject.id);

    teacherAId = (await createTestTeacher(adminToken)).id;
    teacherBId = (await createTestTeacher(adminToken)).id;
    cleanupIds.teacherIds.push(teacherAId, teacherBId);
  });

  afterAll(async () => {
    await prisma.schedule.deleteMany({ where: { courseOfferingId: { in: cleanupIds.offeringIds } } }).catch(() => {});
    await prisma.maintenanceLog.deleteMany({ where: { id: { in: cleanupIds.maintenanceIds } } }).catch(() => {});
    await prisma.courseOffering.deleteMany({ where: { id: { in: cleanupIds.offeringIds } } }).catch(() => {});
    await prisma.subject.deleteMany({ where: { id: { in: cleanupIds.subjectIds } } }).catch(() => {});
    await prisma.teacher.deleteMany({ where: { id: { in: cleanupIds.teacherIds } } }).catch(() => {});
    await prisma.classroom.deleteMany({ where: { id: { in: cleanupIds.classroomIds } } }).catch(() => {});
    await prisma.semester.deleteMany({ where: { id: { in: cleanupIds.semesterIds } } }).catch(() => {});
    await cleanupTestUsers();
  });

  it("POST /schedules - crea bloque de CLASE con comisión", async () => {
    const offering = await createTestOffering(adminToken, {
      semesterId: testSemesterId,
      subjectId,
      teacherId: teacherAId,
      section: "A",
    });
    cleanupIds.offeringIds.push(offering.id);

    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: testClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: offering.id,
        dayOfWeek: 1,
        timeSlotId: "ts-1",
        note: "Bloque principal",
      });
    expect(res.status).toBe(201);
    expect(res.body.schedule.courseOfferingId).toBe(offering.id);
    expect(res.body.schedule.courseOffering.section).toBe("A");
    expect(res.body.schedule.courseOffering.subject.code).toBe(offering.subject.code);
    expect(res.body.schedule.note).toBe("Bloque principal");
    expect(res.body.schedule.title).toBeUndefined();
    expect(res.body.schedule.type).toBeUndefined();
  });

  it("POST /schedules - celda ocupada en otra comisión devuelve RESERVATION_CONFLICT", async () => {
    const offeringB = await createTestOffering(adminToken, {
      semesterId: testSemesterId,
      subjectId,
      teacherId: teacherBId,
      section: "B",
    });
    cleanupIds.offeringIds.push(offeringB.id);

    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: testClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: offeringB.id,
        dayOfWeek: 1,
        timeSlotId: "ts-1",
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("RESERVATION_CONFLICT");
  });

  it("POST /schedules - docente en dos aulas simultáneas devuelve TEACHER_CONFLICT", async () => {
    const offeringShared = await createTestOffering(adminToken, {
      semesterId: testSemesterId,
      subjectId,
      teacherId: teacherAId,
      section: "C",
    });
    cleanupIds.offeringIds.push(offeringShared.id);

    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: otherClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: offeringShared.id,
        dayOfWeek: 1,
        timeSlotId: "ts-1",
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TEACHER_CONFLICT");
  });

  it("POST /schedules - misma comisión dos aulas simultáneas devuelve OFFERING_CONFLICT", async () => {
    const offeringD = await createTestOffering(adminToken, {
      semesterId: testSemesterId,
      subjectId,
      teacherId: null,
      section: "D",
    });
    cleanupIds.offeringIds.push(offeringD.id);

    await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: otherClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: offeringD.id,
        dayOfWeek: 2,
        timeSlotId: "ts-2",
      });
    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: testClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: offeringD.id,
        dayOfWeek: 2,
        timeSlotId: "ts-2",
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OFFERING_CONFLICT");
  });

  it("POST /schedules - semestre distinto al de la comisión devuelve SEMESTER_MISMATCH", async () => {
    const offering = await createTestOffering(adminToken, {
      semesterId: testSemesterId,
      subjectId,
      section: "E",
    });
    cleanupIds.offeringIds.push(offering.id);

    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: testClassroomId,
        semesterId: inactiveSemesterId,
        courseOfferingId: offering.id,
        dayOfWeek: 3,
        timeSlotId: "ts-3",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SEMESTER_MISMATCH");
  });

  it("PATCH /schedules/:id - actualiza nota sin cambiar celda", async () => {
    const offering = await createTestOffering(adminToken, {
      semesterId: testSemesterId,
      subjectId,
      section: "F",
    });
    cleanupIds.offeringIds.push(offering.id);

    const created = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: testClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: offering.id,
        dayOfWeek: 4,
        timeSlotId: "ts-4",
      });
    cleanupIds.scheduleIds.push(created.body.schedule.id);

    const res = await testRequest()
      .patch(`/api/schedules/${created.body.schedule.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ note: "Actualizada" });
    expect(res.status).toBe(200);
    expect(res.body.schedule.note).toBe("Actualizada");
    expect(res.body.schedule.courseOffering.id).toBe(offering.id);
  });

  it("AYUDANTE crea y borra su propio bloque, pero no puede editar ajenos", async () => {
    const ownOffering = await createTestOffering(adminToken, {
      semesterId: testSemesterId,
      subjectId,
      section: "G",
    });
    cleanupIds.offeringIds.push(ownOffering.id);

    const created = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({
        classroomId: otherClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: ownOffering.id,
        dayOfWeek: 5,
        timeSlotId: "ts-5",
      });
    expect(created.status).toBe(201);

    const foreign = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: otherClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: ownOffering.id,
        dayOfWeek: 5,
        timeSlotId: "ts-6",
      });
    cleanupIds.scheduleIds.push(foreign.body.schedule.id);

    const patchForeign = await testRequest()
      .patch(`/api/schedules/${foreign.body.schedule.id}`)
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ note: "Hack" });
    expect(patchForeign.status).toBe(403);

    const patchOwn = await testRequest()
      .patch(`/api/schedules/${created.body.schedule.id}`)
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ note: "Mi nota" });
    expect(patchOwn.status).toBe(200);

    const delOwn = await testRequest().delete(`/api/schedules/${created.body.schedule.id}`).set("Authorization", `Bearer ${helperToken}`);
    expect(delOwn.status).toBe(200);

    const delForeign = await testRequest().delete(`/api/schedules/${foreign.body.schedule.id}`).set("Authorization", `Bearer ${helperToken}`);
    expect(delForeign.status).toBe(403);
  });

  it("GET /schedules - incluye datos de comisión, docente y materia", async () => {
    const res = await testRequest()
      .get(`/api/schedules?classroomId=${testClassroomId}&semesterId=${testSemesterId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const block = res.body.schedules.find((s: any) => s.dayOfWeek === 1 && s.timeSlotId === "ts-1");
    expect(block).toBeTruthy();
    expect(block.courseOffering.subject.name).toBeTruthy();
    expect(block.classroom.code).toBeTruthy();
  });

  it("POST /schedules - sin semestre activo devuelve NO_ACTIVE_SEMESTER", async () => {
    await prisma.semester.updateMany({ data: { isActive: false } });
    try {
      const offering = await createTestOffering(adminToken, {
        semesterId: testSemesterId,
        subjectId,
        section: "I",
      });
      cleanupIds.offeringIds.push(offering.id);

      const res = await testRequest()
        .post("/api/schedules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          classroomId: testClassroomId,
          semesterId: testSemesterId,
          courseOfferingId: offering.id,
          dayOfWeek: 2,
          timeSlotId: "ts-3",
        });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("NO_ACTIVE_SEMESTER");
    } finally {
      await prisma.semester.update({ where: { id: testSemesterId }, data: { isActive: true } }).catch(() => {});
    }
  });

  it("DELETE /schedules/:id - encargado borra cualquier bloque", async () => {
    const created = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: testClassroomId,
        semesterId: testSemesterId,
        courseOfferingId: (await createTestOffering(adminToken, { semesterId: testSemesterId, subjectId, section: "H" })).id,
        dayOfWeek: 6,
        timeSlotId: "ts-6",
      });
    cleanupIds.offeringIds.push(created.body.schedule.courseOfferingId);

    const res = await testRequest().delete(`/api/schedules/${created.body.schedule.id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
