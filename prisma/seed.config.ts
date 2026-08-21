import { ClassroomType, ScheduleType, UserRole } from "@prisma/client";

export interface TimeSlotSeed {
  id: string;
  label: string;
  startTime: string; // formato "HH:mm"
  endTime: string;   // formato "HH:mm"
  order: number;
}

export interface ClassroomSeed {
  id: string;
  code: string;
  name: string;
  type: ClassroomType;
  capacity?: number | null;
  location?: string | null;
}

export interface SemesterSeed {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface AdminSeed {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export const TIME_SLOTS: TimeSlotSeed[] = [
  { id: "ts-1", label: "1° período", startTime: "07:15", endTime: "08:45", order: 1 },
  { id: "ts-2", label: "2° período", startTime: "08:55", endTime: "10:25", order: 2 },
  { id: "ts-3", label: "3° período", startTime: "10:30", endTime: "12:00", order: 3 },
  { id: "ts-4", label: "4° período", startTime: "12:20", endTime: "13:50", order: 4 },
  { id: "ts-5", label: "5° período", startTime: "13:55", endTime: "15:25", order: 5 },
  { id: "ts-6", label: "6° período", startTime: "15:30", endTime: "17:00", order: 6 },
  { id: "ts-7", label: "7° período", startTime: "17:05", endTime: "18:35", order: 7 },
  { id: "ts-8", label: "8° período", startTime: "18:40", endTime: "20:10", order: 8 },
  { id: "ts-9", label: "9° período", startTime: "20:15", endTime: "21:45", order: 9 },
];

export const CLASSROOMS: ClassroomSeed[] = [
  { id: "cls-d302", code: "D302", name: "Aula D302", type: ClassroomType.AULA, capacity: 25 },
  { id: "cls-d304", code: "D304", name: "Aula D304", type: ClassroomType.AULA, capacity: 25 },
  { id: "cls-e112", code: "E112", name: "Aula E112", type: ClassroomType.AULA, capacity: 25 },
  { id: "cls-d401", code: "D401", name: "Aula D401", type: ClassroomType.AULA, capacity: 25 },
  { id: "cls-d402", code: "D402", name: "Aula D402", type: ClassroomType.AULA, capacity: 25 },
  { id: "cls-d403", code: "D403", name: "Aula D403", type: ClassroomType.AULA, capacity: 25 },
  { id: "cls-d404", code: "D404", name: "Aula D404", type: ClassroomType.AULA, capacity: 25 },
];

export const SEMESTER: SemesterSeed = {
  id: "sem-2026-a",
  name: "2026-A",
  startDate: new Date("2026-08-01T00:00:00.000Z"),
  endDate: new Date("2026-12-18T00:00:00.000Z"),
};

export interface ScheduleSeed {
  classroomId: string;
  dayOfWeek: number; // 1 = Lunes ... 6 = Sábado
  timeSlotId: string;
  type: ScheduleType;
  title: string;
  teacher?: string | null;
}

export const SCHEDULES: ScheduleSeed[] = [
  // ============================== D302 ==============================
  { classroomId: "cls-d302", dayOfWeek: 1, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "DD311-A", teacher: "Soria" },
  { classroomId: "cls-d302", dayOfWeek: 1, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "DD111-B", teacher: "Soria" },
  { classroomId: "cls-d302", dayOfWeek: 1, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "DD111-C", teacher: "Ampuero" },
  { classroomId: "cls-d302", dayOfWeek: 1, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "DD211-A", teacher: "Rivera" },
  { classroomId: "cls-d302", dayOfWeek: 1, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "IT312-Z1", teacher: "De la Quintana" },
  { classroomId: "cls-d302", dayOfWeek: 1, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "IT312-Z3", teacher: "Tinoco" },
  { classroomId: "cls-d302", dayOfWeek: 1, timeSlotId: "ts-8", type: ScheduleType.CLASE, title: "IT312-Z2 / DD411-A", teacher: "Céspedes" },
  { classroomId: "cls-d302", dayOfWeek: 1, timeSlotId: "ts-9", type: ScheduleType.CLASE, title: "DD411-A", teacher: "Céspedes" },
  { classroomId: "cls-d302", dayOfWeek: 2, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "PB412-A", teacher: "Talavera" },
  { classroomId: "cls-d302", dayOfWeek: 2, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "PB412-B", teacher: "Talavera" },
  { classroomId: "cls-d302", dayOfWeek: 2, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "DD111-C", teacher: "Ampuero" },
  { classroomId: "cls-d302", dayOfWeek: 2, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "DD311-A", teacher: "De la Quintana" },
  { classroomId: "cls-d302", dayOfWeek: 2, timeSlotId: "ts-8", type: ScheduleType.CLASE, title: "Excel (5/5)" },
  { classroomId: "cls-d302", dayOfWeek: 3, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "DD311-A", teacher: "Soria" },
  { classroomId: "cls-d302", dayOfWeek: 3, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "DD111-B", teacher: "Soria" },
  { classroomId: "cls-d302", dayOfWeek: 3, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "DD111-C", teacher: "Ampuero" },
  { classroomId: "cls-d302", dayOfWeek: 3, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "IT312-Z3", teacher: "Tinoco" },
  { classroomId: "cls-d302", dayOfWeek: 3, timeSlotId: "ts-8", type: ScheduleType.CLASE, title: "IT312-Z2 / DD411-A", teacher: "Céspedes" },
  { classroomId: "cls-d302", dayOfWeek: 3, timeSlotId: "ts-9", type: ScheduleType.CLASE, title: "DD411-A", teacher: "Céspedes" },
  { classroomId: "cls-d302", dayOfWeek: 4, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "PB412-A", teacher: "Talavera" },
  { classroomId: "cls-d302", dayOfWeek: 4, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "PB412-B", teacher: "Talavera" },
  { classroomId: "cls-d302", dayOfWeek: 4, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "DD211-A", teacher: "Rivera" },
  { classroomId: "cls-d302", dayOfWeek: 4, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "DD211-B", teacher: "Rivera S." },
  { classroomId: "cls-d302", dayOfWeek: 4, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "IT312-Z1", teacher: "De la Quintana" },
  { classroomId: "cls-d302", dayOfWeek: 4, timeSlotId: "ts-8", type: ScheduleType.CLASE, title: "Excel (5/5)" },
  { classroomId: "cls-d302", dayOfWeek: 5, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "DD311-A", teacher: "Soria" },
  { classroomId: "cls-d302", dayOfWeek: 5, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "DD211-B", teacher: "Rivera S." },
  { classroomId: "cls-d302", dayOfWeek: 5, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "CV210-Z1", teacher: "Espinoza" },

  // ============================== D304 ==============================
  { classroomId: "cls-d304", dayOfWeek: 1, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "DD111-B", teacher: "Schrupp" },
  { classroomId: "cls-d304", dayOfWeek: 1, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "DD111-A", teacher: "Schrupp" },
  { classroomId: "cls-d304", dayOfWeek: 1, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "IT110-B", teacher: "Crespo" },
  { classroomId: "cls-d304", dayOfWeek: 1, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "DD111-A", teacher: "Schrupp" },
  { classroomId: "cls-d304", dayOfWeek: 1, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "DD111-A", teacher: "Schrupp" },
  { classroomId: "cls-d304", dayOfWeek: 1, timeSlotId: "ts-8", type: ScheduleType.CLASE, title: "CE312-A", teacher: "Cadario" },
  { classroomId: "cls-d304", dayOfWeek: 1, timeSlotId: "ts-9", type: ScheduleType.CLASE, title: "CE312-A", teacher: "Cadario" },
  { classroomId: "cls-d304", dayOfWeek: 2, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "DD410-A", teacher: "Seigelschifer" },
  { classroomId: "cls-d304", dayOfWeek: 2, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "AA326-A", teacher: "Crespo" },
  { classroomId: "cls-d304", dayOfWeek: 2, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "IT422-A", teacher: "Zeballos" },
  { classroomId: "cls-d304", dayOfWeek: 2, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "IT110-A", teacher: "Crespo" },
  { classroomId: "cls-d304", dayOfWeek: 2, timeSlotId: "ts-8", type: ScheduleType.ACTIVIDAD, title: "Aula Común", teacher: "Céspedes" },
  { classroomId: "cls-d304", dayOfWeek: 3, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "DD111-B", teacher: "Schrupp" },
  { classroomId: "cls-d304", dayOfWeek: 3, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "DD111-A", teacher: "Schrupp" },
  { classroomId: "cls-d304", dayOfWeek: 3, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "DD111-C", teacher: "Seigelschifer" },
  { classroomId: "cls-d304", dayOfWeek: 3, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "IT110-A", teacher: "Seigelschifer" },
  { classroomId: "cls-d304", dayOfWeek: 3, timeSlotId: "ts-8", type: ScheduleType.CLASE, title: "CE312-A", teacher: "Cadario" },
  { classroomId: "cls-d304", dayOfWeek: 3, timeSlotId: "ts-9", type: ScheduleType.CLASE, title: "ET514-Z1", teacher: "Gutiérrez" },
  { classroomId: "cls-d304", dayOfWeek: 4, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "DD410-A", teacher: "Seigelschifer" },
  { classroomId: "cls-d304", dayOfWeek: 4, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "AA326-A", teacher: "Crespo" },
  { classroomId: "cls-d304", dayOfWeek: 4, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "CE210-A", teacher: "CIL" },
  { classroomId: "cls-d304", dayOfWeek: 4, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "IT110-B", teacher: "Crespo" },
  { classroomId: "cls-d304", dayOfWeek: 5, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "AA326-A", teacher: "Crespo" },
  { classroomId: "cls-d304", dayOfWeek: 5, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "PB412-A", teacher: "Talavera" },
  { classroomId: "cls-d304", dayOfWeek: 5, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "DD111-C", teacher: "Seigelschifer" },
  { classroomId: "cls-d304", dayOfWeek: 5, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "DD111-E", teacher: "Seigelschifer" },
  { classroomId: "cls-d304", dayOfWeek: 5, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "CV312-Z1", teacher: "Conde" },

  // ============================== E112 ==============================
  { classroomId: "cls-e112", dayOfWeek: 1, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "MO412-B", teacher: "Clouzet" },
  { classroomId: "cls-e112", dayOfWeek: 1, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "MO412-A", teacher: "Clouzet" },
  { classroomId: "cls-e112", dayOfWeek: 1, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "MO412-B", teacher: "Clouzet" },
  { classroomId: "cls-e112", dayOfWeek: 1, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "MO311-A", teacher: "Gutiérrez" },
  { classroomId: "cls-e112", dayOfWeek: 1, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "MO311-B", teacher: "Gutiérrez" },
  { classroomId: "cls-e112", dayOfWeek: 2, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "CV110-A", teacher: "Gianella" },
  { classroomId: "cls-e112", dayOfWeek: 2, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "CV110-B", teacher: "Gianella" },
  { classroomId: "cls-e112", dayOfWeek: 2, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "MO311-A", teacher: "Mercado" },
  { classroomId: "cls-e112", dayOfWeek: 2, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "CE210-B", teacher: "Mercado" },
  { classroomId: "cls-e112", dayOfWeek: 2, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "MO412-D", teacher: "Mercado" },
  { classroomId: "cls-e112", dayOfWeek: 2, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "CE210-D", teacher: "Mercado" },
  { classroomId: "cls-e112", dayOfWeek: 3, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "MO412-A", teacher: "Clouzet" },
  { classroomId: "cls-e112", dayOfWeek: 3, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "MO412-B", teacher: "Clouzet" },
  { classroomId: "cls-e112", dayOfWeek: 3, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "MO412-A", teacher: "Clouzet" },
  { classroomId: "cls-e112", dayOfWeek: 3, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "MO110-A", teacher: "LaFuente" },
  { classroomId: "cls-e112", dayOfWeek: 3, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "MO110-B", teacher: "LaFuente" },
  { classroomId: "cls-e112", dayOfWeek: 3, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "MO110-C", teacher: "LaFuente" },
  { classroomId: "cls-e112", dayOfWeek: 3, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "MO110-D", teacher: "LaFuente" },
  { classroomId: "cls-e112", dayOfWeek: 3, timeSlotId: "ts-8", type: ScheduleType.CLASE, title: "MO110-E", teacher: "LaFuente" },
  { classroomId: "cls-e112", dayOfWeek: 4, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "CE210-E", teacher: "Mercado" },
  { classroomId: "cls-e112", dayOfWeek: 4, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "CV410-A", teacher: "Espinoza" },
  { classroomId: "cls-e112", dayOfWeek: 4, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "CV410-B", teacher: "Espinoza" },
  { classroomId: "cls-e112", dayOfWeek: 4, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "IT110-C", teacher: "S. Pérez" },
  { classroomId: "cls-e112", dayOfWeek: 4, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "MO413-A", teacher: "S. Pérez" },
  { classroomId: "cls-e112", dayOfWeek: 4, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "MO413-B", teacher: "S. Pérez" },
  { classroomId: "cls-e112", dayOfWeek: 5, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "MO211-A", teacher: "Gutiérrez" },
  { classroomId: "cls-e112", dayOfWeek: 5, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "DD211-C", teacher: "Gianella" },
  { classroomId: "cls-e112", dayOfWeek: 5, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "MO211-C", teacher: "Gianella" },
  { classroomId: "cls-e112", dayOfWeek: 5, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "MO110-A", teacher: "LaFuente" },
  { classroomId: "cls-e112", dayOfWeek: 5, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "MO110-B", teacher: "LaFuente" },
  { classroomId: "cls-e112", dayOfWeek: 5, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "CE210-C/MO211-B", teacher: "Mercado" },
  { classroomId: "cls-e112", dayOfWeek: 5, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "MO311-B", teacher: "Gutiérrez" },
  { classroomId: "cls-e112", dayOfWeek: 6, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "MO211-A", teacher: "Gutiérrez" },
  { classroomId: "cls-e112", dayOfWeek: 6, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "MO211-A", teacher: "Gutiérrez" },
  { classroomId: "cls-e112", dayOfWeek: 6, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "MO211-B", teacher: "Gutiérrez" },
  { classroomId: "cls-e112", dayOfWeek: 6, timeSlotId: "ts-4", type: ScheduleType.CLASE, title: "MO211-B", teacher: "Gutiérrez" },

  // ============================== D401 ==============================
  { classroomId: "cls-d401", dayOfWeek: 1, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "MA101-A", teacher: "Rodríguez" },
  { classroomId: "cls-d401", dayOfWeek: 1, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "MA101-A", teacher: "Rodríguez" },
  { classroomId: "cls-d401", dayOfWeek: 3, timeSlotId: "ts-1", type: ScheduleType.CLASE, title: "MA101-A", teacher: "Rodríguez" },
  { classroomId: "cls-d401", dayOfWeek: 3, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "MA101-A", teacher: "Rodríguez" },
  { classroomId: "cls-d401", dayOfWeek: 5, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "FI202-B", teacher: "Vargas" },

  // ============================== D402 ==============================
  { classroomId: "cls-d402", dayOfWeek: 2, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "QU101-C", teacher: "Flores" },
  { classroomId: "cls-d402", dayOfWeek: 2, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "QU101-C", teacher: "Flores" },
  { classroomId: "cls-d402", dayOfWeek: 4, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "QU101-C", teacher: "Flores" },
  { classroomId: "cls-d402", dayOfWeek: 4, timeSlotId: "ts-3", type: ScheduleType.CLASE, title: "QU101-C", teacher: "Flores" },

  // ============================== D403 ==============================
  { classroomId: "cls-d403", dayOfWeek: 1, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "AD101-B", teacher: "Morales" },
  { classroomId: "cls-d403", dayOfWeek: 3, timeSlotId: "ts-5", type: ScheduleType.CLASE, title: "AD101-B", teacher: "Morales" },
  { classroomId: "cls-d403", dayOfWeek: 5, timeSlotId: "ts-6", type: ScheduleType.CLASE, title: "SY302-A", teacher: "Ortega" },

  // ============================== D404 ==============================
  { classroomId: "cls-d404", dayOfWeek: 2, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "CO201-A", teacher: "Méndez" },
  { classroomId: "cls-d404", dayOfWeek: 4, timeSlotId: "ts-7", type: ScheduleType.CLASE, title: "CO201-A", teacher: "Méndez" },
  { classroomId: "cls-d404", dayOfWeek: 6, timeSlotId: "ts-2", type: ScheduleType.CLASE, title: "SE101-Z", teacher: "Pinto" },
];

export const ADMIN: AdminSeed = {
  id: "usr-admin",
  name: "Administrador",
  email: "admin@institucion.edu",
  password: "admin123",
  role: UserRole.ENCARGADO,
};

export const AYUDANTES: AdminSeed[] = [
  { id: "usr-ayudante-1", name: "Ayudante Uno", email: "ayudante1@institucion.edu", password: "ayudante123", role: UserRole.AYUDANTE },
  { id: "usr-ayudante-2", name: "Ayudante Dos", email: "ayudante2@institucion.edu", password: "ayudante123", role: UserRole.AYUDANTE },
  { id: "usr-ayudante-3", name: "Ayudante Tres", email: "ayudante3@institucion.edu", password: "ayudante123", role: UserRole.AYUDANTE },
  { id: "usr-ayudante-4", name: "Ayudante Cuatro", email: "ayudante4@institucion.edu", password: "ayudante123", role: UserRole.AYUDANTE },
];
