import { Router } from "express";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import classroomsRoutes from "./classrooms.routes";
import timeSlotsRoutes from "./time-slots.routes";
import semestersRoutes from "./semesters.routes";
import schedulesRoutes from "./schedules.routes";
import annotationsRoutes from "./annotations.routes";
import maintenanceRoutes from "./maintenance.routes";
import statsRoutes from "./stats.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/classrooms", classroomsRoutes);
router.use("/time-slots", timeSlotsRoutes);
router.use("/semesters", semestersRoutes);
router.use("/schedules", schedulesRoutes);
router.use("/annotations", annotationsRoutes);
router.use("/maintenance", maintenanceRoutes);
router.use("/stats", statsRoutes);

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export { router as apiRouter };