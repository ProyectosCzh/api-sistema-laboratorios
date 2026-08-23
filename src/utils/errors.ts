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
  userHasDependencies: () =>
    new ApiError(
      409,
      "USER_HAS_DEPENDENCIES",
      "No se puede eliminar el usuario porque tiene registros asociados"
    ),
  noActiveSemester: () => new ApiError(409, "NO_ACTIVE_SEMESTER", "No hay semestre activo para operar horarios"),
  classroomUnavailable: (message = "El aula no está disponible para recibir reservas") =>
    new ApiError(409, "CLASSROOM_UNAVAILABLE", message),
  subjectCodeInUse: () => new ApiError(409, "SUBJECT_CODE_IN_USE", "Ya existe una materia con ese código"),
  teacherCodeInUse: () => new ApiError(409, "TEACHER_CODE_IN_USE", "Ya existe un docente con ese código"),
  teacherEmailInUse: () => new ApiError(409, "TEACHER_EMAIL_IN_USE", "Ya existe un docente con ese email"),
  teacherConflict: () => new ApiError(409, "TEACHER_CONFLICT", "El docente ya tiene un bloque en ese día y turno"),
  inactiveCatalogItem: (message = "El registro del catálogo está inactivo y no puede utilizarse") =>
    new ApiError(400, "INACTIVE_CATALOG_ITEM", message),
  nonWorkingDay: (message = "El día indicado no es día hábil del semestre") =>
    new ApiError(400, "NON_WORKING_DAY", message),
  dateOutsideSemester: () =>
    new ApiError(400, "DATE_OUTSIDE_SEMESTER", "La fecha indicada está fuera del rango del semestre"),
  conflict: () => new ApiError(409, "CONFLICT", "Conflicto con un recurso existente"),
  currentPasswordInvalid: () =>
    new ApiError(400, "CURRENT_PASSWORD_INVALID", "La contraseña actual es incorrecta"),
  semesterHasDependencies: () =>
    new ApiError(
      409,
      "SEMESTER_HAS_DEPENDENCIES",
      "No se puede eliminar el semestre porque tiene horarios o reservas asociados"
    ),
  invalidReservationTransition: () =>
    new ApiError(409, "INVALID_RESERVATION_TRANSITION", "La reserva no admite esa transición de estado"),
  reservationNotEditable: () =>
    new ApiError(409, "RESERVATION_NOT_EDITABLE", "Solo se pueden modificar reservas pendientes"),
  semesterActive: () =>
    new ApiError(409, "SEMESTER_ACTIVE", "No se puede eliminar el semestre activo; desactivá otro primero"),
  timeSlotInUse: () =>
    new ApiError(
      409,
      "TIME_SLOT_IN_USE",
      "No se puede eliminar el turno porque tiene horarios asociados"
    ),
  timeSlotOrderInUse: () =>
    new ApiError(409, "TIME_SLOT_ORDER_IN_USE", "Ya existe un turno con ese orden"),
  serviceUnavailable: (message = "Servicio temporalmente no disponible") =>
    new ApiError(503, "SERVICE_UNAVAILABLE", message),
  rateLimited: () => new ApiError(429, "RATE_LIMIT_EXCEEDED", "Demasiados intentos, intentá de nuevo más tarde"),
  internal: (message = "Ocurrió un error inesperado, intentá de nuevo") => new ApiError(500, "INTERNAL_ERROR", message),
};