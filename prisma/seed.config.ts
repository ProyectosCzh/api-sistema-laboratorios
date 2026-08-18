import { ClassroomType, UserRole } from "@prisma/client";

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
  { id: "cls-lab-1", code: "LAB-01", name: "Laboratorio 1", type: ClassroomType.LAB_COMPUTACION },
  { id: "cls-lab-2", code: "LAB-02", name: "Laboratorio 2", type: ClassroomType.LAB_COMPUTACION },
  { id: "cls-aula-1", code: "AULA-01", name: "Aula 1", type: ClassroomType.AULA },
];

export const SEMESTER: SemesterSeed = {
  id: "sem-2026-a",
  name: "2026-A",
  startDate: new Date("2026-08-01T00:00:00.000Z"),
  endDate: new Date("2026-12-18T00:00:00.000Z"),
};

export const ADMIN: AdminSeed = {
  id: "usr-admin",
  name: "Administrador",
  email: "admin@institucion.edu",
  password: "admin123",
  role: UserRole.ENCARGADO,
};
