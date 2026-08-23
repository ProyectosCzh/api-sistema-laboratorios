export type UserRole = "ENCARGADO" | "AYUDANTE";
export type ClassroomType = "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA";
export type ClassroomStatus = "ACTIVA" | "INACTIVA" | "EN_MANTENIMIENTO" | "FUERA_SERVICIO";
export type CourseOfferingType = "CLASE" | "EXTRACURRICULAR" | "ACTIVIDAD";
export type MaintenanceStatus = "REPORTADO" | "EN_PROGRESO" | "COMPLETADO";

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

export type CourseOfferingSummary = {
  id: string;
  semesterId: string;
  section: string;
  type: CourseOfferingType;
  subject: { id: string; code: string; name: string };
  teacher: { id: string; code: string; name: string } | null;
};

export interface CourseOffering extends CourseOfferingSummary {
  note: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  classroomId: string;
  classroom: { id: string; code: string; name: string };
  semesterId: string;
  dayOfWeek: number;
  timeSlotId: string;
  timeSlot: TimeSlot;
  courseOfferingId: string;
  courseOffering: CourseOfferingSummary;
  note: string | null;
  assignedById: string;
  assignedBy: { id: string; name: string };
  updatedAt: string;
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
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

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
