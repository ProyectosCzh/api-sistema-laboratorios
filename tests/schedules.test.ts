import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, loginAsHelper, createTestClassroom, createTestSemester, activateSemester, authHeader } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Schedules", () => {
  let adminToken: string;
  let helperToken: string;
  let testClassroomId: string;
  let testSemesterId: string;
  let helperUserId: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
    const helper = await loginAsHelper();
    helperToken = helper.token;
    helperUserId = helper.user.id;

    const classroom = await createTestClassroom(adminToken, `SCH-${Date.now()}`);
    testClassroomId = classroom.id;

    const semester = await createTestSemester(adminToken, `SEM-${Date.now()}`);
    testSemesterId = semester.id;
    await activateSemester(adminToken, testSemesterId);
  });

  afterAll(async () => {
    await prisma.schedule.deleteMany({ where: { classroomId: testClassroomId, semesterId: testSemesterId } }).catch(() => {});
    await prisma.classroom.delete({ where: { id: testClassroomId } }).catch(() => {});
    await prisma.semester.delete({ where: { id: testSemesterId } }).catch(() => {});
  });

  it("GET /schedules - lista vacía inicialmente", async () => {
    const res = await testRequest()
      .get(`/api/schedules?classroomId=${testClassroomId}&semesterId=${testSemesterId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.schedules).toEqual([]);
  });

  it("POST /schedules - crear reserva (encargado)", async () => {
    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ classroomId: testClassroomId, semesterId: testSemesterId, dayOfWeek: 1, timeSlotId: "ts-1", type: "CLASE", title: "Programación I" });
    expect(res.status).toBe(201);
    expect(res.body.schedule.type).toBe("CLASE");
    expect(res.body.schedule.timeSlot.id).toBe("ts-1");
  });

  it("POST /schedules - conflicto de celda (409)", async () => {
    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ classroomId: testClassroomId, semesterId: testSemesterId, dayOfWeek: 1, timeSlotId: "ts-1", type: "ACTIVIDAD", title: "Conflicto" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("RESERVATION_CONFLICT");
  });

  it("POST /schedules - ayudante no puede crear MANTENIMIENTO", async () => {
    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ classroomId: testClassroomId, semesterId: testSemesterId, dayOfWeek: 2, timeSlotId: "ts-2", type: "MANTENIMIENTO", title: "Mantenimiento" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("POST /schedules - ayudante crea CLASE (su propia)", async () => {
    const res = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ classroomId: testClassroomId, semesterId: testSemesterId, dayOfWeek: 2, timeSlotId: "ts-2", type: "CLASE", title: "Clase Ayudante" });
    expect(res.status).toBe(201);
    expect(res.body.schedule.assignedById).toBeDefined();
  });

  it("PATCH /schedules/:id - ayudante no edita ajeno", async () => {
    const list = await testRequest().get(`/api/schedules?classroomId=${testClassroomId}&semesterId=${testSemesterId}`).set("Authorization", `Bearer ${adminToken}`);
    const adminSchedule = list.body.schedules.find((s: any) => s.assignedById !== helperUserId);
    if (adminSchedule) {
      const res = await testRequest()
        .patch(`/api/schedules/${adminSchedule.id}`)
        .set("Authorization", `Bearer ${helperToken}`)
        .send({ title: "Hack" });
      expect(res.status).toBe(403);
    }
  });

  it("PATCH /schedules/:id - ayudante no cambia a MANTENIMIENTO", async () => {
    const list = await testRequest().get(`/api/schedules?classroomId=${testClassroomId}&semesterId=${testSemesterId}`).set("Authorization", `Bearer ${helperToken}`);
    const mySchedule = list.body.schedules.find((s: any) => s.type === "CLASE" && s.assignedById === helperUserId);
    if (mySchedule) {
      const res = await testRequest()
        .patch(`/api/schedules/${mySchedule.id}`)
        .set("Authorization", `Bearer ${helperToken}`)
        .send({ type: "MANTENIMIENTO" });
      expect(res.status).toBe(403);
    }
  });

  it("DELETE /schedules/:id - ayudante elimina propia", async () => {
    const list = await testRequest().get(`/api/schedules?classroomId=${testClassroomId}&semesterId=${testSemesterId}`).set("Authorization", `Bearer ${helperToken}`);
    const mySchedule = list.body.schedules.find((s: any) => s.type === "CLASE" && s.assignedById === helperUserId);
    if (mySchedule) {
      const res = await testRequest()
        .delete(`/api/schedules/${mySchedule.id}`)
        .set("Authorization", `Bearer ${helperToken}`);
      expect(res.status).toBe(200);
    }
  });

  it("POST /schedules - 409 NO_ACTIVE_SEMESTER cuando no hay semestre activo", async () => {
    await prisma.semester.updateMany({ data: { isActive: false } });
    try {
      const res = await testRequest()
        .post("/api/schedules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ classroomId: testClassroomId, semesterId: testSemesterId, dayOfWeek: 3, timeSlotId: "ts-3", type: "CLASE", title: "Sin activo" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("NO_ACTIVE_SEMESTER");
    } finally {
      await prisma.semester.update({ where: { id: testSemesterId }, data: { isActive: true } });
    }
  });

  it("POST /schedules - permite crear en semestre inactivo si hay activo (flexible)", async () => {
    const inactive = await createTestSemester(adminToken, `SEM-INACT-${Date.now()}`);
    try {
      const res = await testRequest()
        .post("/api/schedules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ classroomId: testClassroomId, semesterId: inactive.id, dayOfWeek: 4, timeSlotId: "ts-4", type: "ACTIVIDAD", title: "Planificación futura" });
      expect(res.status).toBe(201);
      expect(res.body.schedule.semesterId).toBe(inactive.id);
    } finally {
      await prisma.schedule.deleteMany({ where: { semesterId: inactive.id } }).catch(() => {});
      await prisma.semester.delete({ where: { id: inactive.id } }).catch(() => {});
    }
  });
});