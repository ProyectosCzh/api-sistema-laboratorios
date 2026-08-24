import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { apiReference } from "@scalar/express-api-reference";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { openApiDocument } from "./docs/openapi";

export const app = express();

app.set("trust proxy", env.trustProxy);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    // Detrás del BFF Astro el front es mismo origen; si hay WEB_ORIGIN solo
    // ese navegador debe llamar directo a la API.
    origin: env.webOrigin ? env.webOrigin.split(",").map(s => s.trim()) : env.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const morganFormat = env.isProd ? "tiny" : "dev";
app.use(morgan(morganFormat, { skip: req => req.originalUrl?.includes("/health") }));

app.use("/api", apiRouter);
if (env.docsEnabled) {
  app.use("/api/docs", apiReference({ url: "/api/openapi.json", pageTitle: "LABMANAGE API" }));
  app.use("/api/openapi.json", (_req, res) => res.json(openApiDocument));
}

app.use(notFoundHandler);
app.use(errorHandler);
