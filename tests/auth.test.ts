import { describe, it, expect, beforeAll } from "vitest";
import { testRequest, loginAsAdmin } from "./helpers";

describe("Auth", () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
  });

  it("POST /auth/login - login correcto", async () => {
    const res = await testRequest()
      .post("/api/auth/login")
      .send({ email: "admin@institucion.edu", password: "admin123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("admin@institucion.edu");
    expect(res.body.user.role).toBe("ENCARGADO");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("POST /auth/login - credenciales inválidas", async () => {
    const res = await testRequest()
      .post("/api/auth/login")
      .send({ email: "admin@institucion.edu", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("POST /auth/login - validación email inválido", async () => {
    const res = await testRequest()
      .post("/api/auth/login")
      .send({ email: "not-email", password: "admin123" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /auth/me - con token válido", async () => {
    const res = await testRequest()
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.role).toBe("ENCARGADO");
  });

  it("GET /auth/me - sin token", async () => {
    const res = await testRequest().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });

  it("GET /auth/me - token inválido", async () => {
    const res = await testRequest()
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });
});