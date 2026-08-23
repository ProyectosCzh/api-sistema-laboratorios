import { Response } from "express";
import type { PaginationMeta } from "./pagination";

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data });
}

export function paginated<T>(res: Response, data: T[], meta: PaginationMeta): Response {
  return res.status(200).json({ data, meta });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
