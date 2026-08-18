export type UserRole = "ENCARGADO" | "AYUDANTE";
export type ClassroomType = "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA";
export type ScheduleType = "CLASE" | "ACTIVIDAD" | "MANTENIMIENTO";
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
  active: boolean;
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

export interface Schedule {
  id: string;
  classroomId: string;
  semesterId: string;
  dayOfWeek: number;
  timeSlotId: string;
  timeSlot: TimeSlot;
  type: ScheduleType;
  title: string;
  teacher: string | null;
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

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}