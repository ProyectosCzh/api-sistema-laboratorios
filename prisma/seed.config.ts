import { ClassroomType, CourseOfferingType, UserRole } from "@prisma/client";

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

export interface TeacherSeed {
  id: string;
  code: string;
  name: string;
}

export interface SubjectSeed {
  id: string;
  code: string;
  name: string;
  type: CourseOfferingType;
}

export interface BlockSeed {
  classroomCode: string; // código del aula, ej. "D302"
  dayOfWeek: number;     // 1 = Lunes ... 6 = Sábado
  timeSlotOrder: number; // 1..9 (turno oficial)
  subjectCode: string;   // código base de materia, ej. "DD311", "INGLES", "AULA-COMUN"
  section: string;       // comisión, ej. "A", "Z1", "10/4", "5/5", "UNICA"
  teacherCode?: string;  // ausente = sin docente (Excel)
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
  { id: "cls-d201", code: "D201", name: "Aula D201", type: ClassroomType.AULA, capacity: 25 },
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

export const TEACHERS: TeacherSeed[] = [
  { id: "tea-ampuero", code: "AMPUERO", name: "Ampuero" },
  { id: "tea-cadario", code: "CADARIO", name: "Cadario" },
  { id: "tea-cespedes", code: "CESPEDES", name: "Céspedes" },
  { id: "tea-cil", code: "CIL", name: "CIL" },
  { id: "tea-clouzet", code: "CLOUZET", name: "Clouzet" },
  { id: "tea-conde", code: "CONDE", name: "Conde" },
  { id: "tea-crespo", code: "CRESPO", name: "Crespo" },
  { id: "tea-delaquintana", code: "DELAQUINTANA", name: "De la Quintana" },
  { id: "tea-espinoza", code: "ESPINOZA", name: "Espinoza" },
  { id: "tea-flores", code: "FLORES", name: "Flores" },
  { id: "tea-gianella", code: "GIANELLA", name: "Gianella" },
  { id: "tea-gutierrez", code: "GUTIERREZ", name: "Gutiérrez" },
  { id: "tea-inglés", code: "INGLES", name: "Inglés" },
  { id: "tea-lafuente", code: "LAFUENTE", name: "LaFuente" },
  { id: "tea-mendez", code: "MENDEZ", name: "Méndez" },
  { id: "tea-mercado", code: "MERCADO", name: "Mercado" },
  { id: "tea-morales", code: "MORALES", name: "Morales" },
  { id: "tea-ortega", code: "ORTEGA", name: "Ortega" },
  { id: "tea-pinto", code: "PINTO", name: "Pinto" },
  { id: "tea-rivera", code: "RIVERA", name: "Rivera" },
  { id: "tea-riveras", code: "RIVERAS", name: "Rivera S." },
  { id: "tea-rodriguez", code: "RODRIGUEZ", name: "Rodríguez" },
  { id: "tea-sperez", code: "SPEREZ", name: "S. Pérez" },
  { id: "tea-schrupp", code: "SCHRUPP", name: "Schrupp" },
  { id: "tea-seigelschifer", code: "SEIGELSCHIFER", name: "Seigelschifer" },
  { id: "tea-soria", code: "SORIA", name: "Soria" },
  { id: "tea-talavera", code: "TALAVERA", name: "Talavera" },
  { id: "tea-tinoco", code: "TINOCO", name: "Tinoco" },
  { id: "tea-vargas", code: "VARGAS", name: "Vargas" },
  { id: "tea-zeballos", code: "ZEBALLOS", name: "Zeballos" },
];

const REGULAR_SUBJECT_CODES = [
  "AA326", "AD101", "CE210", "CE312", "CO201", "CV110", "CV210", "CV312", "CV410",
  "DD111", "DD211", "DD311", "DD410", "DD411", "ET514", "FI202", "IT110", "IT312",
  "IT422", "MA101", "MO110", "MO211", "MO311", "MO412", "MO413", "PB412", "QU101",
  "SE101", "SY302",
];

export const SUBJECTS: SubjectSeed[] = [
  ...REGULAR_SUBJECT_CODES.map(code => ({ id: `sub-${code.toLowerCase()}`, code, name: code, type: CourseOfferingType.CLASE })),
  { id: "sub-ingles", code: "INGLES", name: "Inglés", type: CourseOfferingType.EXTRACURRICULAR },
  { id: "sub-excel", code: "EXCEL", name: "Excel", type: CourseOfferingType.EXTRACURRICULAR },
  { id: "sub-aula-comun", code: "AULA-COMUN", name: "Aula Común", type: CourseOfferingType.ACTIVIDAD },
];

export const BLOCKS: BlockSeed[] = [
  // ============================== D302 (31) ==============================
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 1, subjectCode: "DD311", section: "A", teacherCode: "SORIA" },
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 2, subjectCode: "DD111", section: "B", teacherCode: "SORIA" },
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 3, subjectCode: "DD111", section: "C", teacherCode: "AMPUERO" },
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 4, subjectCode: "INGLES", section: "10/4", teacherCode: "INGLES" },
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 5, subjectCode: "DD211", section: "A", teacherCode: "RIVERA" },
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 6, subjectCode: "IT312", section: "Z1", teacherCode: "DELAQUINTANA" },
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 7, subjectCode: "IT312", section: "Z3", teacherCode: "TINOCO" },
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 8, subjectCode: "IT312", section: "Z2", teacherCode: "CESPEDES" },
  { classroomCode: "D302", dayOfWeek: 1, timeSlotOrder: 9, subjectCode: "DD411", section: "A", teacherCode: "CESPEDES" },
  { classroomCode: "D302", dayOfWeek: 2, timeSlotOrder: 2, subjectCode: "PB412", section: "A", teacherCode: "TALAVERA" },
  { classroomCode: "D302", dayOfWeek: 2, timeSlotOrder: 3, subjectCode: "PB412", section: "B", teacherCode: "TALAVERA" },
  { classroomCode: "D302", dayOfWeek: 2, timeSlotOrder: 4, subjectCode: "DD111", section: "C", teacherCode: "AMPUERO" },
  { classroomCode: "D302", dayOfWeek: 2, timeSlotOrder: 6, subjectCode: "DD311", section: "A", teacherCode: "DELAQUINTANA" },
  { classroomCode: "D302", dayOfWeek: 2, timeSlotOrder: 8, subjectCode: "EXCEL", section: "5/5" },
  { classroomCode: "D302", dayOfWeek: 3, timeSlotOrder: 1, subjectCode: "DD311", section: "A", teacherCode: "SORIA" },
  { classroomCode: "D302", dayOfWeek: 3, timeSlotOrder: 2, subjectCode: "DD111", section: "B", teacherCode: "SORIA" },
  { classroomCode: "D302", dayOfWeek: 3, timeSlotOrder: 3, subjectCode: "DD111", section: "C", teacherCode: "AMPUERO" },
  { classroomCode: "D302", dayOfWeek: 3, timeSlotOrder: 7, subjectCode: "IT312", section: "Z3", teacherCode: "TINOCO" },
  { classroomCode: "D302", dayOfWeek: 3, timeSlotOrder: 8, subjectCode: "IT312", section: "Z2", teacherCode: "CESPEDES" },
  { classroomCode: "D302", dayOfWeek: 3, timeSlotOrder: 9, subjectCode: "DD411", section: "A", teacherCode: "CESPEDES" },
  { classroomCode: "D302", dayOfWeek: 4, timeSlotOrder: 2, subjectCode: "PB412", section: "A", teacherCode: "TALAVERA" },
  { classroomCode: "D302", dayOfWeek: 4, timeSlotOrder: 3, subjectCode: "PB412", section: "B", teacherCode: "TALAVERA" },
  { classroomCode: "D302", dayOfWeek: 4, timeSlotOrder: 4, subjectCode: "DD211", section: "A", teacherCode: "RIVERA" },
  { classroomCode: "D302", dayOfWeek: 4, timeSlotOrder: 5, subjectCode: "DD211", section: "B", teacherCode: "RIVERAS" },
  { classroomCode: "D302", dayOfWeek: 4, timeSlotOrder: 6, subjectCode: "IT312", section: "Z1", teacherCode: "DELAQUINTANA" },
  { classroomCode: "D302", dayOfWeek: 4, timeSlotOrder: 8, subjectCode: "EXCEL", section: "5/5" },
  { classroomCode: "D302", dayOfWeek: 5, timeSlotOrder: 1, subjectCode: "DD311", section: "A", teacherCode: "SORIA" },
  { classroomCode: "D302", dayOfWeek: 5, timeSlotOrder: 2, subjectCode: "INGLES", section: "10/4", teacherCode: "INGLES" },
  { classroomCode: "D302", dayOfWeek: 5, timeSlotOrder: 3, subjectCode: "INGLES", section: "10/4", teacherCode: "INGLES" },
  { classroomCode: "D302", dayOfWeek: 5, timeSlotOrder: 6, subjectCode: "DD211", section: "B", teacherCode: "RIVERAS" },
  { classroomCode: "D302", dayOfWeek: 5, timeSlotOrder: 7, subjectCode: "CV210", section: "Z1", teacherCode: "ESPINOZA" },

  // ============================== D304 (28) ==============================
  { classroomCode: "D304", dayOfWeek: 1, timeSlotOrder: 2, subjectCode: "DD111", section: "B", teacherCode: "SCHRUPP" },
  { classroomCode: "D304", dayOfWeek: 1, timeSlotOrder: 3, subjectCode: "DD111", section: "A", teacherCode: "SCHRUPP" },
  { classroomCode: "D304", dayOfWeek: 1, timeSlotOrder: 4, subjectCode: "INGLES", section: "10/4-B", teacherCode: "INGLES" },
  { classroomCode: "D304", dayOfWeek: 1, timeSlotOrder: 5, subjectCode: "IT110", section: "B", teacherCode: "CRESPO" },
  { classroomCode: "D304", dayOfWeek: 1, timeSlotOrder: 6, subjectCode: "DD111", section: "A", teacherCode: "SCHRUPP" },
  { classroomCode: "D304", dayOfWeek: 1, timeSlotOrder: 7, subjectCode: "DD111", section: "A", teacherCode: "SCHRUPP" },
  { classroomCode: "D304", dayOfWeek: 1, timeSlotOrder: 8, subjectCode: "CE312", section: "A", teacherCode: "CADARIO" },
  { classroomCode: "D304", dayOfWeek: 1, timeSlotOrder: 9, subjectCode: "CE312", section: "A", teacherCode: "CADARIO" },
  { classroomCode: "D304", dayOfWeek: 2, timeSlotOrder: 1, subjectCode: "DD410", section: "A", teacherCode: "SEIGELSCHIFER" },
  { classroomCode: "D304", dayOfWeek: 2, timeSlotOrder: 2, subjectCode: "AA326", section: "A", teacherCode: "CRESPO" },
  { classroomCode: "D304", dayOfWeek: 2, timeSlotOrder: 3, subjectCode: "IT422", section: "A", teacherCode: "ZEBALLOS" },
  { classroomCode: "D304", dayOfWeek: 2, timeSlotOrder: 4, subjectCode: "IT110", section: "A", teacherCode: "CRESPO" },
  { classroomCode: "D304", dayOfWeek: 2, timeSlotOrder: 8, subjectCode: "AULA-COMUN", section: "UNICA", teacherCode: "CESPEDES" },
  { classroomCode: "D304", dayOfWeek: 3, timeSlotOrder: 2, subjectCode: "DD111", section: "B", teacherCode: "SCHRUPP" },
  { classroomCode: "D304", dayOfWeek: 3, timeSlotOrder: 3, subjectCode: "DD111", section: "A", teacherCode: "SCHRUPP" },
  { classroomCode: "D304", dayOfWeek: 3, timeSlotOrder: 4, subjectCode: "DD111", section: "C", teacherCode: "SEIGELSCHIFER" },
  { classroomCode: "D304", dayOfWeek: 3, timeSlotOrder: 5, subjectCode: "IT110", section: "A", teacherCode: "SEIGELSCHIFER" },
  { classroomCode: "D304", dayOfWeek: 3, timeSlotOrder: 8, subjectCode: "CE312", section: "A", teacherCode: "CADARIO" },
  { classroomCode: "D304", dayOfWeek: 3, timeSlotOrder: 9, subjectCode: "ET514", section: "Z1", teacherCode: "GUTIERREZ" },
  { classroomCode: "D304", dayOfWeek: 4, timeSlotOrder: 1, subjectCode: "DD410", section: "A", teacherCode: "SEIGELSCHIFER" },
  { classroomCode: "D304", dayOfWeek: 4, timeSlotOrder: 2, subjectCode: "AA326", section: "A", teacherCode: "CRESPO" },
  { classroomCode: "D304", dayOfWeek: 4, timeSlotOrder: 3, subjectCode: "CE210", section: "A", teacherCode: "CIL" },
  { classroomCode: "D304", dayOfWeek: 4, timeSlotOrder: 4, subjectCode: "IT110", section: "B", teacherCode: "CRESPO" },
  { classroomCode: "D304", dayOfWeek: 5, timeSlotOrder: 2, subjectCode: "AA326", section: "A", teacherCode: "CRESPO" },
  { classroomCode: "D304", dayOfWeek: 5, timeSlotOrder: 3, subjectCode: "PB412", section: "A", teacherCode: "TALAVERA" },
  { classroomCode: "D304", dayOfWeek: 5, timeSlotOrder: 4, subjectCode: "DD111", section: "C", teacherCode: "SEIGELSCHIFER" },
  { classroomCode: "D304", dayOfWeek: 5, timeSlotOrder: 5, subjectCode: "DD111", section: "E", teacherCode: "SEIGELSCHIFER" },
  { classroomCode: "D304", dayOfWeek: 5, timeSlotOrder: 7, subjectCode: "CV312", section: "Z1", teacherCode: "CONDE" },

  // ============================== E112 (36) ==============================
  { classroomCode: "E112", dayOfWeek: 1, timeSlotOrder: 1, subjectCode: "MO412", section: "B", teacherCode: "CLOUZET" },
  { classroomCode: "E112", dayOfWeek: 1, timeSlotOrder: 2, subjectCode: "MO412", section: "A", teacherCode: "CLOUZET" },
  { classroomCode: "E112", dayOfWeek: 1, timeSlotOrder: 3, subjectCode: "MO412", section: "B", teacherCode: "CLOUZET" },
  { classroomCode: "E112", dayOfWeek: 1, timeSlotOrder: 6, subjectCode: "MO311", section: "A", teacherCode: "GUTIERREZ" },
  { classroomCode: "E112", dayOfWeek: 1, timeSlotOrder: 7, subjectCode: "MO311", section: "B", teacherCode: "GUTIERREZ" },
  { classroomCode: "E112", dayOfWeek: 2, timeSlotOrder: 2, subjectCode: "CV110", section: "A", teacherCode: "GIANELLA" },
  { classroomCode: "E112", dayOfWeek: 2, timeSlotOrder: 3, subjectCode: "CV110", section: "B", teacherCode: "GIANELLA" },
  { classroomCode: "E112", dayOfWeek: 2, timeSlotOrder: 4, subjectCode: "MO311", section: "A", teacherCode: "MERCADO" },
  { classroomCode: "E112", dayOfWeek: 2, timeSlotOrder: 5, subjectCode: "CE210", section: "B", teacherCode: "MERCADO" },
  { classroomCode: "E112", dayOfWeek: 2, timeSlotOrder: 6, subjectCode: "MO412", section: "D", teacherCode: "MERCADO" },
  { classroomCode: "E112", dayOfWeek: 2, timeSlotOrder: 7, subjectCode: "CE210", section: "D", teacherCode: "MERCADO" },
  { classroomCode: "E112", dayOfWeek: 3, timeSlotOrder: 1, subjectCode: "MO412", section: "A", teacherCode: "CLOUZET" },
  { classroomCode: "E112", dayOfWeek: 3, timeSlotOrder: 2, subjectCode: "MO412", section: "B", teacherCode: "CLOUZET" },
  { classroomCode: "E112", dayOfWeek: 3, timeSlotOrder: 3, subjectCode: "MO412", section: "A", teacherCode: "CLOUZET" },
  { classroomCode: "E112", dayOfWeek: 3, timeSlotOrder: 4, subjectCode: "MO110", section: "A", teacherCode: "LAFUENTE" },
  { classroomCode: "E112", dayOfWeek: 3, timeSlotOrder: 5, subjectCode: "MO110", section: "B", teacherCode: "LAFUENTE" },
  { classroomCode: "E112", dayOfWeek: 3, timeSlotOrder: 6, subjectCode: "MO110", section: "C", teacherCode: "LAFUENTE" },
  { classroomCode: "E112", dayOfWeek: 3, timeSlotOrder: 7, subjectCode: "MO110", section: "D", teacherCode: "LAFUENTE" },
  { classroomCode: "E112", dayOfWeek: 3, timeSlotOrder: 8, subjectCode: "MO110", section: "E", teacherCode: "LAFUENTE" },
  { classroomCode: "E112", dayOfWeek: 4, timeSlotOrder: 1, subjectCode: "CE210", section: "E", teacherCode: "MERCADO" },
  { classroomCode: "E112", dayOfWeek: 4, timeSlotOrder: 2, subjectCode: "CV410", section: "A", teacherCode: "ESPINOZA" },
  { classroomCode: "E112", dayOfWeek: 4, timeSlotOrder: 3, subjectCode: "CV410", section: "B", teacherCode: "ESPINOZA" },
  { classroomCode: "E112", dayOfWeek: 4, timeSlotOrder: 4, subjectCode: "IT110", section: "C", teacherCode: "SPEREZ" },
  { classroomCode: "E112", dayOfWeek: 4, timeSlotOrder: 5, subjectCode: "MO413", section: "A", teacherCode: "SPEREZ" },
  { classroomCode: "E112", dayOfWeek: 4, timeSlotOrder: 6, subjectCode: "MO413", section: "B", teacherCode: "SPEREZ" },
  { classroomCode: "E112", dayOfWeek: 5, timeSlotOrder: 1, subjectCode: "MO211", section: "A", teacherCode: "GUTIERREZ" },
  { classroomCode: "E112", dayOfWeek: 5, timeSlotOrder: 2, subjectCode: "DD211", section: "C", teacherCode: "GIANELLA" },
  { classroomCode: "E112", dayOfWeek: 5, timeSlotOrder: 3, subjectCode: "MO211", section: "C", teacherCode: "GIANELLA" },
  { classroomCode: "E112", dayOfWeek: 5, timeSlotOrder: 4, subjectCode: "MO110", section: "A", teacherCode: "LAFUENTE" },
  { classroomCode: "E112", dayOfWeek: 5, timeSlotOrder: 5, subjectCode: "MO110", section: "B", teacherCode: "LAFUENTE" },
  { classroomCode: "E112", dayOfWeek: 5, timeSlotOrder: 6, subjectCode: "CE210", section: "C", teacherCode: "MERCADO" },
  { classroomCode: "E112", dayOfWeek: 5, timeSlotOrder: 7, subjectCode: "MO311", section: "B", teacherCode: "GUTIERREZ" },
  { classroomCode: "E112", dayOfWeek: 6, timeSlotOrder: 1, subjectCode: "MO211", section: "A", teacherCode: "GUTIERREZ" },
  { classroomCode: "E112", dayOfWeek: 6, timeSlotOrder: 2, subjectCode: "MO211", section: "A", teacherCode: "GUTIERREZ" },
  { classroomCode: "E112", dayOfWeek: 6, timeSlotOrder: 3, subjectCode: "MO211", section: "B", teacherCode: "GUTIERREZ" },
  { classroomCode: "E112", dayOfWeek: 6, timeSlotOrder: 4, subjectCode: "MO211", section: "B", teacherCode: "GUTIERREZ" },

  // ============================== D401 (5) ==============================
  { classroomCode: "D401", dayOfWeek: 1, timeSlotOrder: 1, subjectCode: "MA101", section: "A", teacherCode: "RODRIGUEZ" },
  { classroomCode: "D401", dayOfWeek: 1, timeSlotOrder: 2, subjectCode: "MA101", section: "A", teacherCode: "RODRIGUEZ" },
  { classroomCode: "D401", dayOfWeek: 3, timeSlotOrder: 1, subjectCode: "MA101", section: "A", teacherCode: "RODRIGUEZ" },
  { classroomCode: "D401", dayOfWeek: 3, timeSlotOrder: 2, subjectCode: "MA101", section: "A", teacherCode: "RODRIGUEZ" },
  { classroomCode: "D401", dayOfWeek: 5, timeSlotOrder: 3, subjectCode: "FI202", section: "B", teacherCode: "VARGAS" },

  // ============================== D402 (4) ==============================
  { classroomCode: "D402", dayOfWeek: 2, timeSlotOrder: 2, subjectCode: "QU101", section: "C", teacherCode: "FLORES" },
  { classroomCode: "D402", dayOfWeek: 2, timeSlotOrder: 3, subjectCode: "QU101", section: "C", teacherCode: "FLORES" },
  { classroomCode: "D402", dayOfWeek: 4, timeSlotOrder: 2, subjectCode: "QU101", section: "C", teacherCode: "FLORES" },
  { classroomCode: "D402", dayOfWeek: 4, timeSlotOrder: 3, subjectCode: "QU101", section: "C", teacherCode: "FLORES" },

  // ============================== D403 (3) ==============================
  { classroomCode: "D403", dayOfWeek: 1, timeSlotOrder: 5, subjectCode: "AD101", section: "B", teacherCode: "MORALES" },
  { classroomCode: "D403", dayOfWeek: 3, timeSlotOrder: 5, subjectCode: "AD101", section: "B", teacherCode: "MORALES" },
  { classroomCode: "D403", dayOfWeek: 5, timeSlotOrder: 6, subjectCode: "SY302", section: "A", teacherCode: "ORTEGA" },

  // ============================== D404 (3) ==============================
  { classroomCode: "D404", dayOfWeek: 2, timeSlotOrder: 7, subjectCode: "CO201", section: "A", teacherCode: "MENDEZ" },
  { classroomCode: "D404", dayOfWeek: 4, timeSlotOrder: 7, subjectCode: "CO201", section: "A", teacherCode: "MENDEZ" },
  { classroomCode: "D404", dayOfWeek: 6, timeSlotOrder: 2, subjectCode: "SE101", section: "Z", teacherCode: "PINTO" },
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
