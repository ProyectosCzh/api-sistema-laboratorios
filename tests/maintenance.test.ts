import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  testRequest,
  loginAsAdmin,
  loginAsHelper,
  createTestClassroom,
  createTestSemester,
  activateSemester,
  createTestOffering,
  cleanupTestUsers,
} from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Maintenance", () => {
  let adminToken: string;
  let helperToken: string;
  let testClassroomId: string;

  const cleanup = { maintenanceIds: [] as string[], offeringIds: [] as string[] };

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
    const helper = await loginAsHelper();
    helperToken = helper.token;

    const classroom = await createTestClassroom(adminToken, `MNT-${Date.now()}`);
    testClassroomId = classroom.id;
  });

  afterAll(async () => {
    await prisma.schedule.deleteMany({ where: { courseOfferingId: { in: cleanup.offeringIds } } }).catch(() => {});
    await prisma.maintenanceLog.deleteMany({ where: { id: { in: cleanup.maintenanceIds } } }).catch(() => {});
    await prisma.courseOffering.deleteMany({ where: { id: { in: cleanup.offeringIds } } }).catch(() => {});
    if (testClassroomId) {
      await prisma.classroom.delete({ where: { id: testClassroomId } }).catch(() => {});
    }
    await cleanupTestUsers();
  });

  it("GET /maintenance - lista", async () => {
    const res = await testRequest().get("/api/maintenance").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.maintenance)).toBe(true);
  });

  it("POST /maintenance - ayudante crea reporte", async () => {
    const res = await testRequest()
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ classroomId: testClassroomId, date: new Date().toISOString().split("T")[0], reason: "Falla proyector" });
    expect(res.status).toBe(201);
    expect(res.body.maintenance.status).toBe("REPORTADO");
  });

  it("PATCH /maintenance/:id - solo encargado cambia estado", async () => {
    const create = await testRequest()
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ classroomId: testClassroomId, date: new Date().toISOString().split("T")[0], reason: "Test" });
    const res = await testRequest()
      .patch(`/api/maintenance/${create.body.maintenance.id}`)
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ status: "EN_PROGRESO" });
    expect(res.status).toBe(403);

    const res2 = await testRequest()
      .patch(`/api/maintenance/${create.body.maintenance.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "EN_PROGRESO" });
    expect(res2.status).toBe(200);
    expect(res2.body.maintenance.status).toBe("EN_PROGRESO");
  });

  it("DELETE /maintenance/:id - solo encargado", async () => {
    const create = await testRequest()
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ classroomId: testClassroomId, date: new Date().toISOString().split("T")[0], reason: "Para borrar" });
    const res = await testRequest()
      .delete(`/api/maintenance/${create.body.maintenance.id}`)
      .set("Authorization", `Bearer ${helperToken}`);
    expect(res.status).toBe(403);

    const res2 = await testRequest()
      .delete(`/api/maintenance/${create.body.maintenance.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res2.status).toBe(200);
  });

  it("POST /maintenance - reporte pasa el aula a EN_MANTENIMIENTO y bloquea reservas", async () => {
    const semester = await createTestSemester(adminToken, `SEM-MNT-${Date.now()}`);
    await activateSemester(adminToken, semester.id);
    const offering = await createTestOffering(adminToken, { semesterId: semester.id });
    cleanup.offeringIds.push(offering.id);

    const report = await testRequest()
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ classroomId: testClassroomId, date: new Date().toISOString().split("T")[0], reason: "Fuga de agua" });
    expect(report.status).toBe(201);
    cleanup.maintenanceIds.push(report.body.maintenance.id);

    const classroom = await testRequest().get("/api/classrooms").set("Authorization", `Bearer ${adminToken}`);
    const updated = classroom.body.classrooms.find((c: any) => c.id === testClassroomId);
    expect(updated.status).toBe("EN_MANTENIMIENTO");

    const schedule = await testRequest()
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classroomId: testClassroomId,
        semesterId: semester.id,
        courseOfferingId: offering.id,
        dayOfWeek: 1,
        timeSlotId: "ts-1",
      });
    expect(schedule.status).toBe(409);
    expect(schedule.body.error.code).toBe("CLASSROOM_UNAVAILABLE");
  });

  it("PATCH /maintenance/:id - completar devuelve el aula a ACTIVA", async () => {
    const list = await testRequest()
      .get(`/api/maintenance?classroomId=${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const open = list.body.maintenance.filter((m: any) => m.status !== "COMPLETADO");
    expect(open.length).toBeGreaterThan(0);

    for (const m of open) {
      const res = await testRequest()
        .patch(`/api/maintenance/${m.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "COMPLETADO", resolutionNotes: "Reparado" });
      expect(res.status).toBe(200);
      expect(res.body.maintenance.status).toBe("COMPLETADO");
    }

    const classrooms = await testRequest().get("/api/classrooms").set("Authorization", `Bearer ${adminToken}`);
    const restored = classrooms.body.classrooms.find((c: any) => c.id === testClassroomId);
    expect(restored.status).toBe("ACTIVA");
  });
});