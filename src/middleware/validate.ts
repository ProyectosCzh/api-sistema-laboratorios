import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

interface ValidatedData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

declare global {
  namespace Express {
    interface Request {
      validated?: ValidatedData;
    }
  }
}

function parse(source: "body" | "query" | "params", schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    req.validated ??= {};
    req.validated[source] = result.data;
    if (source === "body") {
      req.body = result.data;
    }
    next();
  };
}

export const validateBody = (schema: ZodType) => parse("body", schema);
export const validateQuery = (schema: ZodType) => parse("query", schema);
export const validateParams = (schema: ZodType) => parse("params", schema);

export function getBody<T>(req: Request): T {
  return req.validated?.body as T;
}

export function getQuery<T>(req: Request): T {
  return req.validated?.query as T;
}

export function getParams<T = { id: string }>(req: Request): T {
  return req.validated?.params as T;
}
