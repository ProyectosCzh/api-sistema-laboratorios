import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, loginAsHelper } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Subjects", () => {
  let adminToken: string;
  let helperToken: string;
  let subjectId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
    const helper = await loginAsHelper();
    helperToken = helper.token;
  });

  afterAll(async () => {
    await prisma.subject.deleteMany({ where: { id: { in: [...createdIds, subjectId].filter(Boolean) } } }).catch(() => {});
  });

  it("GET /subjects - lista materias del catálogo", async () => {
    const res = await testRequest().get("/api/subjects").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.subjects.some((s: any) => s.code === "DD111")).toBe(true);
    expect(res.body.subjects.every((s: any) => s.active !== false)).toBe(true);
  });

  it("POST /subjects - crea materia normalizando el código a mayúsculas", async () => {
    const code = `tsb-${Date.now()}`;
    const res = await testRequest()
      .post("/api/subjects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, name: "Test Subject" });
    expect(res.status).toBe(201);
    expect(res.body.subject.code).toBe(code.toUpperCase());
    expect(res.body.subject.active).toBe(true);
    subjectId = res.body.subject.id;
  });

  it("POST /subjects - solo ENCARGADO puede crear", async () => {
    const res = await testRequest()
      .post("/api/subjects")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ code: "NOPE1", name: "No permitido" });
    expect(res.status).toBe(403);
  });

  it("POST /subjects - código duplicado devuelve SUBJECT_CODE_IN_USE", async () => {
    const res = await testRequest()
      .post("/api/subjects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "DD111", name: "Duplicada" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SUBJECT_CODE_IN_USE");
  });

  it("PATCH /subjects/:id - actualiza nombre y estado", async () => {
    const created = await testRequest()
      .post("/api/subjects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: `OTR-${Date.now()}`, name: "Otra" });
    createdIds.push(created.body.subject.id);

    const renamed = await testRequest()
      .patch(`/api/subjects/${created.body.subject.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Otra Editada" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.subject.name).toBe("Otra Editada");

    const deactivated = await testRequest()
      .patch(`/api/subjects/${created.body.subject.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.subject.active).toBe(false);

    const list = await testRequest()
      .get("/api/subjects?includeInactive=true")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.subjects.some((s: any) => s.id === created.body.subject.id && s.active === false)).toBe(true);
  });

  it("DELETE /subjects/:id - baja lógica y el código no se puede reusar", async () => {
    const target = createdIds[createdIds.length - 1];
    const res = await testRequest().delete(`/api/subjects/${target}`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const record = await prisma.subject.findUnique({ where: { id: target } });
    expect(record?.active).toBe(false);

    const reuse = await testRequest()
      .post("/api/subjects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: record!.code, name: "Reuso" });
    expect(reuse.status).toBe(409);
    expect(reuse.body.error.code).toBe("SUBJECT_CODE_IN_USE");
  });
});
