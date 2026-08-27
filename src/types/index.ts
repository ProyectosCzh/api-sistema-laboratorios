export type UserRole = "ENCARGADO" | "AYUDANTE";
export type ClassroomType = "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA";
export type ClassroomStatus = "ACTIVA" | "INACTIVA" | "EN_MANTENIMIENTO" | "FUERA_SERVICIO";
export type MaintenanceStatus = "REPORTADO" | "EN_PROGRESO" | "COMPLETADO";
export type ReservationType = "RECURRENTE" | "PUNTUAL";
export type ReservationStatus = "PENDIENTE" | "CONFIRMADA" | "CANCELADA";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Classroom {
  id: string;
  code: string;
  name: string;
  type: ClassroomType;
  capacity: number | null;
  location: string | null;
  status: ClassroomStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  order: number;
}

export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  workingDays: number[];
  isActive: boolean;
}

export interface Teacher {
  id: string;
  code: string;
  name: string;
  email: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectSummary {
  id: string;
  code: string;
  name: string;
}

export interface TeacherSummary {
  id: string;
  code: string;
  name: string;
}

export type ReservationRequester = { id: string; name: string };
export type ReservationResolver = { id: string; name: string };

export interface Schedule {
  id: string;
  classroomId: string;
  classroom: { id: string; code: string; name: string };
  semesterId: string;
  subjectId: string;
  subject: SubjectSummary;
  teacherId: string | null;
  teacher: TeacherSummary | null;
  dayOfWeek: number;
  timeSlotId: string;
  timeSlot: TimeSlot;
  note: string | null;
  assignedById: string;
  assignedBy: { id: string; name: string };
  updatedAt: string;
}

export interface Reservation {
  id: string;
  classroomId: string;
  classroom: { id: string; code: string; name: string };
  semesterId: string;
  type: ReservationType;
  dayOfWeek: number | null;
  date: string | null;
  timeSlotId: string;
  timeSlot: TimeSlot;
  status: ReservationStatus;
  note: string | null;
  requestedById: string;
  requestedBy: ReservationRequester;
  resolvedById: string | null;
  resolvedBy: ReservationResolver | null;
  createdAt: string;
  updatedAt: string;
}

/// Estado puntual de un aula según el documento base (sección 5.4)
export type ClassroomAvailabilityState = "LIBRE" | "OCUPADA" | "MANTENIMIENTO";

export interface ClassroomStateResult {
  classroomId: string;
  classroom: { id: string; code: string; name: string };
  date: string;
  dayOfWeek: number;
  timeSlotId: string;
  state: ClassroomAvailabilityState;
  reason?: string;
  occupiedBy?:
    | { kind: "SCHEDULE"; schedule: Schedule }
    | { kind: "RESERVATION"; reservation: Reservation };
}

export type GridEntryKind = "SCHEDULE" | "RESERVATION";

export interface AvailabilityGridCell {
  dayOfWeek: number;
  timeSlotId: string;
  entry:
    | null
    | { kind: "SCHEDULE"; scheduleId: string; subject: SubjectSummary; teacher: TeacherSummary | null }
    | {
        kind: "RESERVATION";
        reservationId: string;
        type: ReservationType;
        status: ReservationStatus;
        date: string | null;
      };
}

export interface AvailabilityGridClassroom {
  classroom: { id: string; code: string; name: string };
  maintenance: Array<{
    id: string;
    date: string;
    reason: string;
    status: MaintenanceStatus;
  }>;
  cells: AvailabilityGridCell[];
}

export interface Annotation {
  id: string;
  classroomId: string;
  userId: string;
  user: { id: string; name: string };
  date: string;
  content: string;
}

export interface MaintenanceLog {
  id: string;
  classroomId: string;
  classroom: { id: string; code: string; name: string };
  date: string;
  reason: string;
  status: MaintenanceStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatsOverview {
  totalClassrooms: number;
  classroomsByType: { type: ClassroomType; count: number }[];
  activeSemester: { id: string; name: string } | null;
  occupancyByClassroom: {
    classroom: { id: string; code: string; name: string };
    occupiedSlots: number;
    totalSlots: number;
    percentage: number;
  }[];
  pendingMaintenance: number;
  reservationsByStatus: { status: ReservationStatus; count: number }[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type { PaginationMeta } from "../utils/pagination";

export interface HealthStatus {
  status: "ok";
  db: "up" | "down";
  uptime: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}
