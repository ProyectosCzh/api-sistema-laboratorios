import { stableStringify } from "./cache";
import type { CacheSetOptions } from "./cache";

const MINUTE_MS = 60_000;

/**
 * Políticas de cache por dominio (TTL + tags). Los tags permiten invalidar
 * por grupo: 'catalog' (catálogos), `grid:{semesterId}` (grilla por semestre),
 * 'stats' y `user:{id}`.
 */
export const CACHE_POLICIES = {
  /** Listados de catálogo estables: turnos, materias, docentes. */
  timeSlots: { ttlMs: 10 * MINUTE_MS, tags: ["catalog"] } satisfies CacheSetOptions,
  subjects: { ttlMs: 10 * MINUTE_MS, tags: ["catalog"] } satisfies CacheSetOptions,
  teachers: { ttlMs: 10 * MINUTE_MS, tags: ["catalog"] } satisfies CacheSetOptions,
  /** Aulas y semestres cambian algo más seguido. */
  classrooms: { ttlMs: 5 * MINUTE_MS, tags: ["catalog"] } satisfies CacheSetOptions,
  semesters: { ttlMs: 5 * MINUTE_MS, tags: ["catalog"] } satisfies CacheSetOptions,
  /** Grilla semanal: datos vivos, TTL corto con stale-while-revalidate.
   *  Tag por semestre: `grid:{semesterId}`. */
  grid: {
    ttlMs: 20_000,
    staleWhileRevalidateMs: 40_000,
  } satisfies CacheSetOptions,
  statsOverview: { ttlMs: MINUTE_MS, tags: ["stats"] } satisfies CacheSetOptions,
  /** Usuario para auth/perfil: TTL corto; se invalida en cada escritura. */
  userById: { ttlMs: MINUTE_MS } satisfies CacheSetOptions,
};

/**
 * Claves canónicas. Los listados paginados/filtrados serializan sus filtros
 * con stableStringify para que la clave sea determinista.
 */
export const CACHE_KEYS = {
  timeSlotsList: "catalog:timeSlots",
  subjectsList: (filters: unknown): string => `catalog:subjects:${stableStringify(filters)}`,
  teachersList: (filters: unknown): string => `catalog:teachers:${stableStringify(filters)}`,
  classroomsList: (filters: unknown): string => `catalog:classrooms:${stableStringify(filters)}`,
  semestersList: (page: number, pageSize: number): string => `catalog:semesters:p${page}:s${pageSize}`,
  grid: (semesterId: string, filters?: unknown): string =>
    `grid:${semesterId}${filters === undefined ? "" : `:${stableStringify(filters)}`}`,
  statsOverview: "stats:overview",
  user: (id: string): string => `user:${id}`,
};
