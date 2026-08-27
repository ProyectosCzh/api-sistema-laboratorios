import { Router } from "express";
import { prisma } from "../lib/prisma";
import { createGlobalLimiter } from "../middleware/rateLimit";
import { ok } from "../utils/responses";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import classroomsRoutes from "./classrooms.routes";
import timeSlotsRoutes from "./time-slots.routes";
import semestersRoutes from "./semesters.routes";
import subjectsRoutes from "./subjects.routes";
import teachersRoutes from "./teachers.routes";
import schedulesRoutes from "./schedules.routes";
import reservationsRoutes from "./reservations.routes";
import availabilityRoutes from "./availability.routes";
import annotationsRoutes from "./annotations.routes";
import maintenanceRoutes from "./maintenance.routes";
import statsRoutes from "./stats.routes";

const router = Router();

// Authorization patterns:
// - Pattern A (route-level): Resources that only ENCARGADO can modify → requireRole("ENCARGADO") middleware
//   Applied to: users, classrooms (write), subjects (write), teachers (write), semesters (write), maintenance (update/delete), reservations (delete)
// - Pattern B (service-level): Resources where AYUDANTE can create/modify their own records → service enforces ownership
//   Applied to: schedules, reservations (create/update/status), annotations

router.use(createGlobalLimiter());

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/classrooms", classroomsRoutes);
router.use("/time-slots", timeSlotsRoutes);
router.use("/semesters", semestersRoutes);
router.use("/subjects", subjectsRoutes);
router.use("/teachers", teachersRoutes);
router.use("/schedules", schedulesRoutes);
router.use("/reservations", reservationsRoutes);
router.use("/availability", availabilityRoutes);
router.use("/annotations", annotationsRoutes);
router.use("/maintenance", maintenanceRoutes);
router.use("/stats", statsRoutes);

router.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, { status: "ok", db: "up", uptime: process.uptime() }, 200);
  } catch {
    ok(res, { status: "degraded", db: "down", uptime: process.uptime() }, 503);
  }
});

export { router as apiRouter };