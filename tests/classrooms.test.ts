import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, createTestClassroom } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Classrooms", () => {
  let adminToken: string;
  let testClassroomId: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
  });

  afterAll(async () => {
    if (testClassroomId) {
      await prisma.classroom.delete({ where: { id: testClassroomId } }).catch(() => {});
    }
  });

  it("GET /classrooms - listar aulas", async () => {
    const res = await testRequest().get("/api/classrooms").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.classrooms)).toBe(true);
    expect(res.body.classrooms.length).toBeGreaterThan(0);
  });

  it("POST /classrooms - crear aula", async () => {
    const res = await testRequest()
      .post("/api/classrooms")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: `TEST-${Date.now()}`, name: "Aula Test", type: "AULA", capacity: 30 });
    expect(res.status).toBe(201);
    expect(res.body.classroom.code).toMatch(/^TEST-/);
    expect(res.body.classroom.status).toBe("ACTIVA");
    testClassroomId = res.body.classroom.id;
  });

  it("POST /classrooms - código duplicado", async () => {
    const code = `DUP-${Date.now()}`;
    await testRequest().post("/api/classrooms").set("Authorization", `Bearer ${adminToken}`).send({ code, name: "U1", type: "AULA" });
    const res = await testRequest().post("/api/classrooms").set("Authorization", `Bearer ${adminToken}`).send({ code, name: "U2", type: "AULA" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CLASSROOM_CODE_IN_USE");
  });

  it("PATCH /classrooms/:id - actualizar aula", async () => {
    const res = await testRequest()
      .patch(`/api/classrooms/${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Aula Actualizada", capacity: 40 });
    expect(res.status).toBe(200);
    expect(res.body.classroom.name).toBe("Aula Actualizada");
    expect(res.body.classroom.capacity).toBe(40);
  });

  it("PATCH /classrooms/:id - cambia status", async () => {
    const res = await testRequest()
      .patch(`/api/classrooms/${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVA" });
    expect(res.status).toBe(200);
    expect(res.body.classroom.status).toBe("INACTIVA");

    const restore = await testRequest()
      .patch(`/api/classrooms/${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVA" });
    expect(restore.status).toBe(200);
  });

  it("GET /classrooms?status= - filtra por estado", async () => {
    const activas = await testRequest()
      .get("/api/classrooms?status=ACTIVA")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(activas.status).toBe(200);
    expect(activas.body.classrooms.length).toBeGreaterThan(0);
    expect(activas.body.classrooms.every((c: any) => c.status === "ACTIVA")).toBe(true);

    await testRequest()
      .patch(`/api/classrooms/${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "FUERA_SERVICIO" });

    const fuera = await testRequest()
      .get("/api/classrooms?status=FUERA_SERVICIO")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(fuera.body.classrooms.some((c: any) => c.id === testClassroomId)).toBe(true);
    expect(activas.body.classrooms.some((c: any) => c.id === testClassroomId)).toBe(true);

    const restaurar = await testRequest()
      .patch(`/api/classrooms/${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVA" });
    expect(restaurar.status).toBe(200);
  });

  it("DELETE /classrooms/:id - soft delete pasa a INACTIVA", async () => {
    const res = await testRequest()
      .delete(`/api/classrooms/${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const list = await testRequest().get("/api/classrooms?includeInactive=true").set("Authorization", `Bearer ${adminToken}`);
    const deleted = list.body.classrooms.find((c: any) => c.id === testClassroomId);
    expect(deleted.status).toBe("INACTIVA");
    expect(deleted.active).toBeUndefined();

    const soloInactivas = await testRequest()
      .get("/api/classrooms?status=INACTIVA&includeInactive=true")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(soloInactivas.body.classrooms.some((c: any) => c.id === testClassroomId)).toBe(true);
  });
});