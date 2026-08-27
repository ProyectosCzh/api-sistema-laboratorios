import { Response } from "express";
import type { PaginationMeta } from "./pagination";

export function ok<T>(res: Response, data: T, status = 200): Response {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ data });
}

export function paginated<T>(res: Response, data: T[], meta: PaginationMeta): Response {
  return res.status(200).json({ data, meta });
}

export function noContent(res: Response): Response {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(204).send();
}

/**
 * Helper para uso futuro en rutas: setea Cache-Control privado (NUNCA public)
 * antes de responder. No altera ok/created/paginated existentes.
 */
export function okCached<T>(res: Response, data: T, maxAgeSeconds: number, status = 200): Response {
  res.set("Cache-Control", `private,max-age=${maxAgeSeconds}`);
  return res.status(status).json({ data });
}

/** Igual que paginated pero con Cache-Control privado (listados cacheados en service). */
export function paginatedCached<T>(res: Response, data: T[], meta: PaginationMeta, maxAgeSeconds: number): Response {
  res.set("Cache-Control", `private,max-age=${maxAgeSeconds}`);
  return res.status(200).json({ data, meta });
}
