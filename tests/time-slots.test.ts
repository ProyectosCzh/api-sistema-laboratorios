import { describe, it, expect, beforeAll } from "vitest";
import { testRequest, loginAsAdmin } from "./helpers";

describe("Time Slots", () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await loginAsAdmin();
    adminToken = admin.token;
  });

  it("GET /time-slots - 9 turnos ordenados", async () => {
    const res = await testRequest().get("/api/time-slots").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.timeSlots).toHaveLength(9);
    for (let i = 0; i < 8; i++) {
      expect(res.body.timeSlots[i].order).toBeLessThan(res.body.timeSlots[i + 1].order);
    }
  });
});