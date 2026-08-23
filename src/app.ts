import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { apiReference } from "@scalar/express-api-reference";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { openApiDocument } from "./docs/openapi";

export const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

const morganFormat = env.isProd ? "tiny" : "dev";
app.use(morgan(morganFormat, { skip: req => req.originalUrl?.includes("/health") }));

app.use("/api", apiRouter);
app.use("/api/docs", apiReference({ url: "/api/openapi.json", pageTitle: "LABMANAGE API" }));
app.use("/api/openapi.json", (_req, res) => res.json(openApiDocument));

app.use(notFoundHandler);
app.use(errorHandler);