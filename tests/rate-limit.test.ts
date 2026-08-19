import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createLoginLimiter } from "../src/middleware/rateLimit";

describe("Rate limit", () => {
  it("devuelve 429 RATE_LIMIT_EXCEEDED al superar el límite", async () => {
    const app = express();
    app.post("/test", createLoginLimiter({ max: 2, windowMs: 60000 }), (_req, res) => res.json({ ok: true }));

    await request(app).post("/test").expect(200);
    await request(app).post("/test").expect(200);

    const limited = await request(app).post("/test");
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});