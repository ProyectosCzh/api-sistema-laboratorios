import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRequest, loginAsAdmin, createTestClassroom, createTestSemester, activateSemester, authHeader } from "./helpers";
import { prisma } from "../src/lib/prisma";

describe("Stats", () => {
  let adminToken: string;
  let testClassroomId: string;
  let testSemesterId: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;

    const classroom = await createTestClassroom(adminToken, `STS-${Date.now()}`);
    testClassroomId = classroom.id;

    const semester = await createTestSemester(adminToken, `SEM-STATS-${Date.now()}`);
    testSemesterId = semester.id;
    await activateSemester(adminToken, testSemesterId);
  });

  afterAll(async () => {
    await prisma.schedule.deleteMany({ where: { classroomId: testClassroomId, semesterId: testSemesterId } }).catch(() => {});
    await prisma.classroom.delete({ where: { id: testClassroomId } }).catch(() => {});
    await prisma.semester.delete({ where: { id: testSemesterId } }).catch(() => {});
  });

  it("GET /stats/overview - estructura correcta", async () => {
    const res = await testRequest().get("/api/stats/overview").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalClassrooms).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.classroomsByType)).toBe(true);
    expect(res.body.activeSemester).toBeTruthy();
    expect(Array.isArray(res.body.occupancyByClassroom)).toBe(true);
    expect(typeof res.body.pendingMaintenance).toBe("number");
  });

  it("GET /stats/overview - occupancyByClassroom incluye porcentaje", async () => {
    const res = await testRequest().get("/api/stats/overview").set("Authorization", `Bearer ${adminToken}`);
    const occupancy = res.body.occupancyByClassroom.find((o: any) => o.classroom.id === testClassroomId);
    expect(occupancy).toBeDefined();
    expect(occupancy.occupiedSlots).toBe(0);
    expect(occupancy.totalSlots).toBe(54);
    expect(occupancy.percentage).toBe(0);
  });
});