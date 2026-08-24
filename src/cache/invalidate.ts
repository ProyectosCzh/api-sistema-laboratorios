import { cache } from "./cache";

/** Invalida todos los listados de catálogo (turnos, materias, docentes, aulas, semestres). */
export function invalidateCatalog(): void {
  cache.invalidateTag("catalog");
}

/** Invalida la grilla de un semestre (todas sus variantes de filtro). */
export function invalidateGridFor(semesterId: string): void {
  cache.invalidatePrefix(`grid:${semesterId}`);
}

/** Invalida las grillas de todos los semestres. */
export function invalidateAllGrids(): void {
  cache.invalidatePrefix("grid:");
}

export function invalidateStats(): void {
  cache.invalidateTag("stats");
}

/** Llamar al final de escrituras de schedules/reservations que afectan ocupación. */
export function invalidateOccupancy(semesterId: string): void {
  invalidateGridFor(semesterId);
  invalidateStats();
}

/**
 * Los mantenimientos no tienen semestre: pueden afectar grillas de cualquier
 * semestre (rango de fechas) además del contador de stats.
 */
export function invalidateMaintenanceImpact(): void {
  invalidateAllGrids();
  invalidateStats();
}

/** Al activar un semestre cambian catálogo, grillas y estadísticas. */
export function invalidateSemesterActivation(): void {
  invalidateCatalog();
  invalidateAllGrids();
  invalidateStats();
}
