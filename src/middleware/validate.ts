import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

export function validate<T>(schema: ZodType<T>, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }
    if (source === "body") {
      req.body = result.data;
    }
    // No reasignar req.query ni req.params (son getters de solo lectura en Express)
    // La validación ya pasó; los handlers usan req.query/req.params directamente
    next();
  };
}