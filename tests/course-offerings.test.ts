import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, loginAsHelper, createTestSubject, createTestTeacher } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Course Offerings", () => {
  let adminToken: string;
  let helperToken: string;
  let semesterId: string;
  let subjectId: string;
  let teacherAId: string;
  let teacherBId: string;

  const cleanup = {
    offeringIds: [] as string[],
    subjectIds: [] as string[],
    teacherIds: [] as string[],
    semesterId: "",
  };

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
    const helper = await loginAsHelper();
    helperToken = helper.token;

    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sem = await testRequest()
      .post("/api/semesters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `SEM-OFF-${Date.now()}`.slice(0, 20), startDate: start.toISOString(), endDate: end.toISOString() });
    semesterId = sem.body.semester.id;
    cleanup.semesterId = semesterId;

    subjectId = (await createTestSubject(adminToken)).id;
    teacherAId = (await createTestTeacher(adminToken)).id;
    teacherBId = (await createTestTeacher(adminToken)).id;
    cleanup.subjectIds.push(subjectId);
    cleanup.teacherIds.push(teacherAId, teacherBId);
  });

  afterAll(async () => {
    await prisma.courseOffering.deleteMany({ where: { id: { in: cleanup.offeringIds } } }).catch(() => {});
    await prisma.semester.delete({ where: { id: cleanup.semesterId } }).catch(() => {});
    await prisma.subject.deleteMany({ where: { id: { in: cleanup.subjectIds } } }).catch(() => {});
    await prisma.teacher.deleteMany({ where: { id: { in: cleanup.teacherIds } } }).catch(() => {});
  });

  async function createOffering(overrides: Record<string, unknown> = {}) {
    const res = await testRequest()
      .post("/api/course-offerings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(
        {
          semesterId,
          subjectId,
          section: "Z1",
          ...overrides,
        }
      );
    if (res.status === 201) cleanup.offeringIds.push(res.body.offering.id);
    return res;
  }

  it("GET /course-offerings?semesterId - lista comisiones del semestre", async () => {
    const res = await testRequest()
      .get(`/api/course-offerings?semesterId=${semesterId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.offerings)).toBe(true);
  });

  it("POST /course-offerings - crea con tipo y docente", async () => {
    const res = await createOffering({ teacherId: teacherAId, section: "a", type: "EXTRACURRICULAR" });
    expect(res.status).toBe(201);
    expect(res.body.offering.section).toBe("A");
    expect(res.body.offering.type).toBe("EXTRACURRICULAR");
    expect(res.body.offering.teacher.id).toBe(teacherAId);
    expect(res.body.offering.subject.code).toBeTruthy();
  });

  it("POST /course-offerings - sin docente queda null", async () => {
    const res = await createOffering({ section: "ND" });
    expect(res.status).toBe(201);
    expect(res.body.offering.teacher).toBeNull();
  });

  it("POST /course-offerings - solo ENCARGADO", async () => {
    const res = await testRequest()
      .post("/api/course-offerings")
      .set("Authorization", `Bearer ${helperToken}`)
      .send({ semesterId, subjectId, section: "X" });
    expect(res.status).toBe(403);
  });

  it("POST /course-offerings - duplicada devuelve OFFERING_ALREADY_EXISTS", async () => {
    await createOffering({ teacherId: teacherBId, section: "DUP" });
    const res = await createOffering({ teacherId: teacherBId, section: "dup" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OFFERING_ALREADY_EXISTS");
  });

  it("POST /course-offerings - misma materia y sección con otro docente se permite", async () => {
    const first = await createOffering({ teacherId: teacherAId, section: "SHARED" });
    const second = await createOffering({ teacherId: teacherBId, section: "SHARED" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.offering.id).not.toBe(first.body.offering.id);
  });

  it("PATCH /course-offerings - cambio de sección a una existente devuelve conflicto", async () => {
    const target = await createOffering({ teacherId: teacherAId, section: "P1" });
    await createOffering({ teacherId: teacherAId, section: "P2" });

    const res = await testRequest()
      .patch(`/api/course-offerings/${target.body.offering.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ section: "p2" });
    expect(res.status).toBe(409);

    const ok = await testRequest()
      .patch(`/api/course-offerings/${target.body.offering.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ note: "Sin cambios de sección" });
    expect(ok.status).toBe(200);
  });

  it("DELETE /course-offerings/:id - baja lógica", async () => {
    const created = await createOffering({ section: "DEL" });
    const res = await testRequest()
      .delete(`/api/course-offerings/${created.body.offering.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const record = await prisma.courseOffering.findUnique({ where: { id: created.body.offering.id } });
    expect(record?.active).toBe(false);
  });
});
