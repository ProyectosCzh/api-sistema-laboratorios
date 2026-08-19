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

  it("DELETE /classrooms/:id - soft delete", async () => {
    const res = await testRequest()
      .delete(`/api/classrooms/${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const list = await testRequest().get("/api/classrooms?includeInactive=true").set("Authorization", `Bearer ${adminToken}`);
    const deleted = list.body.classrooms.find((c: any) => c.id === testClassroomId);
    expect(deleted.active).toBe(false);
  });
});