import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, loginAsHelper } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Teachers", () => {
  let adminToken: string;
  let helperToken: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
    const helper = await loginAsHelper();
    helperToken = helper.token;
  });

  afterAll(async () => {
    await prisma.teacher.deleteMany({ where: { id: { in: createdIds } } }).catch(() => {});
  });

  async function createTeacher(overrides: Record<string, unknown> = {}) {
    const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const res = await testRequest()
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: `tst-${s}`, name: "Docente De Prueba", email: `${s}@test.local`, ...overrides });
    if (res.status === 201) createdIds.push(res.body.teacher.id);
    return res;
  }

  it("GET /teachers - lista docentes del catálogo", async () => {
    const res = await testRequest().get("/api/teachers").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.teachers.some((t: any) => t.code === "SORIA")).toBe(true);
    expect(res.body.teachers.every((t: any) => t.active !== false)).toBe(true);
  });

  it("POST /teachers - crea docente normalizando código y email", async () => {
    const res = await createTeacher({ email: undefined });
    expect(res.status).toBe(201);
    expect(res.body.teacher.code).toMatch(/^TST-/);
    expect(res.body.teacher.active).toBe(true);
  });

  it("POST /teachers - solo ENCARGADO puede crear", async () => {
    const res = await testRequest()
      .post("/api/teachers")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ code: "NOPE1", name: "No Permitido" });
    expect(res.status).toBe(403);
  });

  it("POST /teachers - código duplicado devuelve TEACHER_CODE_IN_USE", async () => {
    const res = await createTeacher({ code: "SORIA" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TEACHER_CODE_IN_USE");
  });

  it("POST /teachers - email duplicado devuelve TEACHER_EMAIL_IN_USE", async () => {
    const first = await createTeacher();
    expect(first.status).toBe(201);

    const res = await createTeacher({ email: first.body.teacher.email!.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TEACHER_EMAIL_IN_USE");
  });

  it("PATCH /teachers/:id - actualiza nombre y estado", async () => {
    const teacher = await createTeacher();
    const res = await testRequest()
      .patch(`/api/teachers/${teacher.body.teacher.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Nombre Editado" });
    expect(res.status).toBe(200);
    expect(res.body.teacher.name).toBe("Nombre Editado");

    const deactivated = await testRequest()
      .patch(`/api/teachers/${teacher.body.teacher.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.teacher.active).toBe(false);

    const list = await testRequest().get("/api/teachers").set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.teachers.some((t: any) => t.id === teacher.body.teacher.id)).toBe(false);
  });

  it("DELETE /teachers/:id - baja lógica", async () => {
    const teacher = await createTeacher();
    const res = await testRequest()
      .delete(`/api/teachers/${teacher.body.teacher.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const record = await prisma.teacher.findUnique({ where: { id: teacher.body.teacher.id } });
    expect(record?.active).toBe(false);
  });
});
