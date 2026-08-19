export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Array<{ field?: string; message: string }>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ApiErrors = {
  validation: (details: Array<{ field?: string; message: string }>) =>
    new ApiError(400, "VALIDATION_ERROR", "Revisá los datos ingresados", details),
  cannotDeleteSelf: () => new ApiError(400, "CANNOT_DELETE_SELF", "No podés eliminar tu propio usuario"),
  invalidCredentials: () => new ApiError(401, "AUTH_INVALID_CREDENTIALS", "Email o contraseña incorrectos"),
  tokenInvalid: () => new ApiError(401, "TOKEN_INVALID", "Token ausente, malformado o de firma inválida"),
  tokenExpired: () => new ApiError(401, "TOKEN_EXPIRED", "Token vencido"),
  userInactive: () => new ApiError(401, "USER_INACTIVE", "El usuario está desactivado"),
  forbidden: (message = "No tenés permisos para esta acción") => new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "El recurso no existe") => new ApiError(404, "NOT_FOUND", message),
  reservationConflict: () => new ApiError(409, "RESERVATION_CONFLICT", "Ese turno ya está ocupado en esta aula"),
  emailInUse: () => new ApiError(409, "EMAIL_IN_USE", "Ese email ya está registrado"),
  classroomCodeInUse: () => new ApiError(409, "CLASSROOM_CODE_IN_USE", "Ya existe un aula con ese código"),
  noActiveSemester: () => new ApiError(409, "NO_ACTIVE_SEMESTER", "No hay semestre activo para operar horarios"),
  conflict: () => new ApiError(409, "CONFLICT", "Conflicto con un recurso existente"),
  rateLimited: () => new ApiError(429, "RATE_LIMIT_EXCEEDED", "Demasiados intentos, intentá de nuevo más tarde"),
  internal: (message = "Ocurrió un error inesperado, intentá de nuevo") => new ApiError(500, "INTERNAL_ERROR", message),
};