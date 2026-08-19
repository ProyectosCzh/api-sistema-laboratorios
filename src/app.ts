import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);