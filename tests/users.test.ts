import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Users (ENCARGADO)", () => {
  let adminToken: string;
  let createdUserId: string;
  let dupUserId: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
  });

  afterAll(async () => {
    for (const id of [createdUserId, dupUserId]) {
      if (id) await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  });

  it("GET /users - listar usuarios", async () => {
    const res = await testRequest().get("/api/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.some((u: any) => u.email === "admin@institucion.edu")).toBe(true);
  });

  it("POST /users - crear usuario", async () => {
    const res = await testRequest()
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Nuevo Usuario", email: `newuser-${Date.now()}@test.com`, password: "password123", role: "AYUDANTE" });
    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe("Nuevo Usuario");
    expect(res.body.user.role).toBe("AYUDANTE");
    expect(res.body.user.passwordHash).toBeUndefined();
    createdUserId = res.body.user.id;
  });

  it("POST /users - email duplicado", async () => {
    const email = `dup-${Date.now()}@test.com`;
    const first = await testRequest().post("/api/users").set("Authorization", `Bearer ${adminToken}`).send({ name: "U1", email, password: "password123", role: "AYUDANTE" });
    dupUserId = first.body.user.id;
    const res = await testRequest().post("/api/users").set("Authorization", `Bearer ${adminToken}`).send({ name: "U2", email, password: "password123", role: "AYUDANTE" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("PATCH /users/:id - actualizar usuario", async () => {
    const res = await testRequest()
      .patch(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Actualizado", active: false });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Actualizado");
    expect(res.body.user.active).toBe(false);
  });

  it("DELETE /users/:id - soft delete", async () => {
    const res = await testRequest()
      .delete(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const list = await testRequest().get("/api/users").set("Authorization", `Bearer ${adminToken}`);
    const deleted = list.body.users.find((u: any) => u.id === createdUserId);
    expect(deleted.active).toBe(false);
  });

  it("DELETE /users/:id - no puede eliminarse a sí mismo", async () => {
    const adminRes = await testRequest().get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`);
    const adminId = adminRes.body.user.id;
    const res = await testRequest().delete(`/api/users/${adminId}`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_DELETE_SELF");
  });
});