import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, createTestSemester, activateSemester, authHeader } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Semesters", () => {
  let adminToken: string;
  let testSemesterId: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
  });

  afterAll(async () => {
    if (testSemesterId) {
      await prisma.semester.delete({ where: { id: testSemesterId } }).catch(() => {});
    }
  });

  it("GET /semesters - listar semestres", async () => {
    const res = await testRequest().get("/api/semesters").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.semesters)).toBe(true);
  });

  it("POST /semesters - crear semestre", async () => {
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const res = await testRequest()
      .post("/api/semesters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `TEST-${Date.now()}`, startDate: start.toISOString(), endDate: end.toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.semester.isActive).toBe(false);
    testSemesterId = res.body.semester.id;
  });

  it("POST /semesters - validación endDate > startDate", async () => {
    const start = new Date();
    const end = new Date(start.getTime() - 1000);
    const res = await testRequest()
      .post("/api/semesters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "INVALID", startDate: start.toISOString(), endDate: end.toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("PATCH /semesters/:id - actualizar semestre", async () => {
    const res = await testRequest()
      .patch(`/api/semesters/${testSemesterId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Actualizado" });
    expect(res.status).toBe(200);
    expect(res.body.semester.name).toBe("Actualizado");
  });

  it("POST /semesters/:id/activate - activar semestre", async () => {
    const res = await testRequest()
      .post(`/api/semesters/${testSemesterId}/activate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.semester.isActive).toBe(true);
  });
});