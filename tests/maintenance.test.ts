import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, loginAsHelper, createTestClassroom, authHeader } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Maintenance", () => {
  let adminToken: string;
  let helperToken: string;
  let testClassroomId: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
    const helper = await loginAsHelper();
    helperToken = helper.token;

    const classroom = await createTestClassroom(adminToken, `MNT-${Date.now()}`);
    testClassroomId = classroom.id;
  });

  afterAll(async () => {
    await prisma.maintenanceLog.deleteMany({ where: { classroomId: testClassroomId } }).catch(() => {});
    await prisma.classroom.delete({ where: { id: testClassroomId } }).catch(() => {});
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
});