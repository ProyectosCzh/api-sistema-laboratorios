import { app } from "../src/app";
import request from "supertest";
import { prisma } from "../src/lib/prisma";

export const testRequest = () => request(app);

export async function loginAsAdmin(): Promise<{ token: string; user: any }> {
  const res = await testRequest()
    .post("/api/auth/login")
    .send({ email: "admin@institucion.edu", password: "admin123" });
  if (res.status !== 200) throw new Error(`Admin login failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

export async function loginAsHelper(): Promise<{ token: string; user: any }> {
  const helper = await prisma.user.findFirst({ where: { role: "AYUDANTE", active: true } });
  if (!helper) {
    const admin = await loginAsAdmin();
    const email = `helper-${Date.now()}@test.com`;
    await testRequest()
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Ayudante Test", email, password: "helper123", role: "AYUDANTE" });
    const res = await testRequest().post("/api/auth/login").send({ email, password: "helper123" });
    return { token: res.body.token, user: res.body.user };
  }
  const res = await testRequest().post("/api/auth/login").send({ email: helper.email, password: "helper123" });
  return { token: res.body.token, user: res.body.user };
}

export async function createTestClassroom(adminToken: string, code: string) {
  const res = await testRequest()
    .post("/api/classrooms")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ code, name: `Test ${code}`, type: "AULA" });
  if (res.status !== 201) throw new Error(`Create classroom failed: ${JSON.stringify(res.body)}`);
  return res.body.classroom;
}

export async function createTestSemester(adminToken: string, name: string) {
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

export async function activateSemester(adminToken: string, id: string) {
  const res = await testRequest()
    .post(`/api/semesters/${id}/activate`)
    .set("Authorization", `Bearer ${adminToken}`);
  if (res.status !== 200) throw new Error(`Activate semester failed: ${JSON.stringify(res.body)}`);
  return res.body.semester;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}