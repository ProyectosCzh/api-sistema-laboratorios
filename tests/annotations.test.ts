import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, loginAsHelper, createTestClassroom, authHeader } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Annotations", () => {
  let adminToken: string;
  let helperToken: string;
  let testClassroomId: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
    const helper = await loginAsHelper();
    helperToken = helper.token;

    const classroom = await createTestClassroom(adminToken, `ANN-${Date.now()}`);
    testClassroomId = classroom.id;
  });

  afterAll(async () => {
    await prisma.annotation.deleteMany({ where: { classroomId: testClassroomId } }).catch(() => {});
    await prisma.classroom.delete({ where: { id: testClassroomId } }).catch(() => {});
  });

  it("GET /annotations - lista vacía", async () => {
    const res = await testRequest()
      .get(`/api/annotations?classroomId=${testClassroomId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.annotations).toEqual([]);
  });

  it("POST /annotations - crear anotación", async () => {
    const res = await testRequest()
      .post("/api/annotations")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ classroomId: testClassroomId, content: "Test anotación" });
    expect(res.status).toBe(201);
    expect(res.body.annotation.content).toBe("Test anotación");
    expect(res.body.annotation.user.id).toBeDefined();
  });

  it("DELETE /annotations/:id - ayudante elimina propia", async () => {
    const create = await testRequest()
      .post("/api/annotations")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ classroomId: testClassroomId, content: "Para borrar" });
    const res = await testRequest()
      .delete(`/api/annotations/${create.body.annotation.id}`)
      .set("Authorization", `Bearer ${helperToken}`);
    expect(res.status).toBe(200);
  });

  it("DELETE /annotations/:id - ayudante no elimina ajena", async () => {
    const create = await testRequest()
      .post("/api/annotations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ classroomId: testClassroomId, content: "De admin" });
    const res = await testRequest()
      .delete(`/api/annotations/${create.body.annotation.id}`)
      .set("Authorization", `Bearer ${helperToken}`);
    expect(res.status).toBe(403);
  });
});