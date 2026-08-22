import { app } from "../src/app";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import type { AuthResponse, Classroom, CourseOffering, Semester, Subject, Teacher } from "../src/types";

export const testRequest = () => request(app);

const createdTestUserIds: string[] = [];

export async function loginAsAdmin(): Promise<AuthResponse> {
  const res = await testRequest()
    .post("/api/auth/login")
    .send({ email: "admin@institucion.edu", password: "admin123" });
  if (res.status !== 200) throw new Error(`Admin login failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

export async function loginAsHelper(): Promise<AuthResponse> {
  const admin = await loginAsAdmin();
  const email = `helper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const res = await testRequest()
    .post("/api/users")
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ name: "Ayudante Test", email, password: "helper123", role: "AYUDANTE" });
  if (res.status !== 201) throw new Error(`Create helper failed: ${JSON.stringify(res.body)}`);
  createdTestUserIds.push(res.body.user.id);

  const login = await testRequest().post("/api/auth/login").send({ email, password: "helper123" });
  if (login.status !== 200) throw new Error(`Helper login failed: ${JSON.stringify(login.body)}`);
  return { token: login.body.token, user: login.body.user };
}

export async function cleanupTestUsers(): Promise<void> {
  await prisma.user.deleteMany({ where: { id: { in: createdTestUserIds } } }).catch(() => {});
  createdTestUserIds.length = 0;
}

export async function createTestClassroom(adminToken: string, code: string): Promise<Classroom> {
  const res = await testRequest()
    .post("/api/classrooms")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ code, name: `Test ${code}`, type: "AULA" });
  if (res.status !== 201) throw new Error(`Create classroom failed: ${JSON.stringify(res.body)}`);
  return res.body.classroom;
}

export async function createTestSemester(adminToken: string, name: string): Promise<Semester> {
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const shortName = name.length > 20 ? name.slice(0, 20) : name;
  const res = await testRequest()
    .post("/api/semesters")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: shortName, startDate: start.toISOString(), endDate: end.toISOString() });
  if (res.status !== 201) throw new Error(`Create semester failed: ${JSON.stringify(res.body)}`);
  return res.body.semester;
}

export async function activateSemester(adminToken: string, id: string): Promise<Semester> {
  const res = await testRequest()
    .post(`/api/semesters/${id}/activate`)
    .set("Authorization", `Bearer ${adminToken}`);
  if (res.status !== 200) throw new Error(`Activate semester failed: ${JSON.stringify(res.body)}`);
  return res.body.semester;
}

const suffix = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function createTestSubject(adminToken: string, code?: string): Promise<Subject> {
  const res = await testRequest()
    .post("/api/subjects")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ code: code ?? `TST-${suffix()}`, name: "Materia de prueba" });
  if (res.status !== 201) throw new Error(`createTestSubject failed: ${JSON.stringify(res.body)}`);
  return res.body.subject;
}

export async function createTestTeacher(adminToken: string, code?: string): Promise<Teacher> {
  const s = suffix();
  const res = await testRequest()
    .post("/api/teachers")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ code: code ?? `tst-${s}`, name: "Docente De Prueba", email: `${s}@test.local` });
  if (res.status !== 201) throw new Error(`createTestTeacher failed: ${JSON.stringify(res.body)}`);
  return res.body.teacher;
}

export async function createTestOffering(
  adminToken: string,
  opts: { semesterId: string; subjectId?: string; teacherId?: string | null; section?: string; type?: "CLASE" | "EXTRACURRICULAR" | "ACTIVIDAD" }
): Promise<CourseOffering> {
  const subjectId = opts.subjectId ?? (await createTestSubject(adminToken)).id;
  const teacherId = opts.teacherId === undefined ? (await createTestTeacher(adminToken)).id : opts.teacherId;
  const res = await testRequest()
    .post("/api/course-offerings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      semesterId: opts.semesterId,
      subjectId,
      teacherId: teacherId ?? null,
      section: opts.section ?? "A",
      type: opts.type ?? "CLASE",
    });
  if (res.status !== 201) throw new Error(`createTestOffering failed: ${JSON.stringify(res.body)}`);
  return res.body.offering;
}