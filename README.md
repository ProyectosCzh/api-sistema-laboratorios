# LABMANAGE API

Backend REST de **LABMANAGE**, sistema de gestión de aulas/laboratorios: disponibilidad, reservas, uso y estados de las aulas de una institución.

Este proyecto es la **API** que administra la base de datos. El frontend (`labmanage-web`, Astro + React) **solo** consume esta API a través de HTTP/JSON con autenticación JWT.

> **Fuente de verdad**: el concepto funcional vive en [`PROYECTOMINIMO.md`](./PROYECTOMINIMO.md) (seis entidades, Tabla Semanal de Disponibilidad, flujos Encargado/Ayudante) y su realineamiento ejecutado en [`PLAN_REALINEACION_MODELO.md`](./PLAN_REALINEACION_MODELO.md). Este README documenta el **comportamiento real** de la implementación y prevalece ante cualquier divergencia.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 LTS+ |
| API | Express 5 + TypeScript estricto (`tsx` dev, `tsc` build) |
| ORM | Prisma 6 (`@prisma/client` + CLI) |
| BD | PostgreSQL en **Neon** (serverless) |
| Auth | JWT (`jsonwebtoken`, expiración 12h) + `bcryptjs` (salt 12) |
| Validación | Zod 4 (en el límite de la API) |
| Seguridad | Helmet · CORS · rate limiting (`express-rate-limit`: global 300/15min + login 20/15min) · body limit 1 MB |
| Logging | `morgan` (formato `dev` en desarrollo, `tiny` en producción; silencia `/health`) |

## Arquitectura

```
labmanage-web  ──(HTTP + JSON + JWT Bearer)──►  labmanage-api  ──(Prisma)──►  Neon PostgreSQL
 (Astro+React)                                   (Express+TS)
```

- La API **no guarda estado en memoria**: toda la persistencia vive en PostgreSQL/Neon vía Prisma. Nada funciona sin `DATABASE_URL`.
- Todos los endpoints viven bajo el prefijo `/api`.
- CORS restringido al origen configurado en `CORS_ORIGIN` (por defecto `http://localhost:4321`).
- Sin monorepo: cada proyecto tiene su propio `package.json`, `node_modules` y `.env`.

### Estructura del proyecto

```
labmanage-api/
├── prisma/
│   ├── schema.prisma        # Modelos, enums y relaciones (DDL)
│   ├── migrations/          # Migración única: 20260823065113_init
│   ├── seed.config.ts       # Datos maestros editables por la institución
│   └── seed.ts              # Seed idempotente (upsert + validación de conflictos)
├── src/
│   ├── index.ts             # Arranque del servidor (app.listen)
│   ├── app.ts               # Express: helmet, cors, json, router /api, errorHandler
│   ├── config/env.ts        # Variables de entorno tipadas (valida que existan)
│   ├── lib/prisma.ts        # Instancia única de PrismaClient
│   ├── middleware/
│   │   ├── auth.ts          # requireAuth, requireRole (adjunta req.user)
│   │   ├── validate.ts      # Validación Zod genérica (body | query | params)
│   │   ├── rateLimit.ts     # Rate limiters: global (300/15min) y login (20/15min)
│   │   └── errorHandler.ts  # Traduce Zod y errores Prisma al formato { error }
│   ├── routes/              # Definen endpoints, middlewares y validación Zod
│   ├── services/
│   │   ├── slotAvailability.service.ts  # ★ Reglas transaccionales de ocupación compartidas
│   │   ├── schedule.service.ts          # Planilla semanal (materia + docente)
│   │   ├── reservation.service.ts       # Reservas con ciclo de vida
│   │   ├── availability.service.ts      # Estado del aula + grilla semanal
│   │   └── ...                           # auth, users, classrooms, semesters, etc.
│   ├── types/index.ts       # Tipos de respuesta compartidos (fuente de verdad)
│   ├── docs/openapi.ts      # Spec OpenAPI servida con Scalar (/api/docs)
│   └── utils/               # errors.ts (ApiErrors) · dbErrors.ts (P2002) · serializers.ts
```

★ `slotAvailability.service.ts` es el núcleo del sistema: toda operación que ocupa una celda (crear/editar horario, crear reserva recurrente o puntual, confirmar reserva) ejecuta las mismas validaciones dentro de una transacción interactiva de Prisma.

### Convenciones temporales (importantes)

- Toda fecha calendario se normaliza a **medianoche UTC** (`utcStartOfDay`). Enviar `YYYY-MM-DD` o ISO.
- El día de la semana se deriva de la fecha UTC (`getUTCDay`). `dayOfWeek`: **1=Lunes … 6=Sábado** (domingo no laborable).
- Los turnos son los 9 bloques horarios oficiales (07:15 a 21:45).

---

## Flujo típico de uso

```mermaid
sequenceDiagram
    participant F as Frontend
    participant A as API

    Note over F,A: 1. Autenticación
    F->>A: POST /api/auth/login {email, password}
    A-->>F: 200 {data: {token, user}}

    Note over F,A: 2. Carga inicial
    F->>A: GET /api/time-slots · /classrooms · /semesters · /subjects · /teachers
    A-->>F: catálogos completos

    Note over F,A: 3. Configuración (solo ENCARGADO)
    Encargado->>A: POST /api/subjects · /teachers (catálogos)
    Encargado->>A: POST /api/schedules {classroomId, semesterId, subjectId, teacherId?, dayOfWeek, timeSlotId}
    A-->>Encargado: 201 planilla semanal (materia+docente por celda)

    Note over F,A: 4. Operación diaria — Reservas (AYUDANTE pide, ENCARGADO confirma)
    Ayudante->>A: POST /api/reservations {classroomId, semesterId, type: RECURRENTE|PUNTUAL, dayOfWeek?|date?, timeSlotId}
    alt Celda libre
        A-->>Ayudante: 201 {reservation} status=PENDIENTE
    else Conflicto
        A-->>Ayudante: 409 RESERVATION_CONFLICT | CLASSROOM_UNAVAILABLE | NON_WORKING_DAY | DATE_OUTSIDE_SEMESTER
    end
    Encargado->>A: PATCH /api/reservations/:id/status {status: "CONFIRMADA"}
    A-->>Encargado: 200 revalida disponibilidad antes de confirmar

    Note over F,A: 5. Consulta de disponibilidad (§5.4 y §7 del doc base)
    F->>A: GET /api/classrooms/:id/state?date=&timeSlotId=
    A-->>F: {state: LIBRE | OCUPADA | MANTENIMIENTO, occupiedBy?}
    F->>A: GET /api/availability/grid?semesterId=X
    A-->>F: matriz días × turnos por aula (Tabla Semanal)

    Note over F,A: 6. Mantenimiento y bitácora
    Ayudante->>A: POST /api/maintenance {classroomId, date, reason}
    Note over A: aula → EN_MANTENIMIENTO; bloquea nuevas reservas (§8)
    Encargado->>A: PATCH /api/maintenance/:id {status: "COMPLETADO"}
    F->>A: GET /api/stats/overview (+ reservationsByStatus)
```

---

## Requisitos y puesta en marcha

- Node.js 20 LTS o superior.
- Una base de datos PostgreSQL (recomendada: Neon, plan gratuito).

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y completa los valores reales:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string de PostgreSQL. Usa la conexión **directa** (no la pooled) para Prisma. | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require` |
| `JWT_SECRET` | Secreto para firmar los JWT. Genera uno con `openssl rand -hex 32`. | `cambiar-por-un-secreto-largo-aleatorio` |
| `PORT` | Puerto de la API. | `3001` |
| `CORS_ORIGIN` | Origen(es) permitido(s) del frontend, separados por coma. | `http://localhost:4321` |

> **Nota**: `env.ts` exige `DATABASE_URL` y `JWT_SECRET`; si faltan, el proceso no arranca.

### 3. Aplicar migraciones y cargar datos iniciales

```bash
npx prisma migrate dev
npm run prisma:seed
```

> El seed valida el dataset antes de escribir: referencias existentes, celdas únicas y sin conflicto de docente entre aulas. Falla con error explícito si hay datos inconsistentes en `seed.config.ts`.

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Arranca con `tsx watch` (recarga en caliente) |
| `npm run build` | Compila TypeScript a `dist/` (`tsc`) |
| `npm start` | Ejecuta el build (`node dist/index.js`) |
| `npm run typecheck` | Verificación de tipos (`tsc --noEmit`) |
| `npm run prisma:seed` | Carga/actualiza los datos maestros desde `seed.config.ts` |

---

## Modelo de datos

Esquema completo en `prisma/schema.prisma`. Diez modelos organizados en **catálogos**, **planilla**, **operación** y **bitácora**:

| Modelo | Descripción | Campos clave |
|--------|-------------|--------------|
| `User` | Usuario del sistema | `email` (único), `passwordHash`, `role`, `active` |
| `Teacher` | Docente del catálogo académico | `code` (único), `name`, `email?` (único), `active` |
| `Subject` | Materia del catálogo académico | `code` (único), `name`, `active` |
| `Classroom` | Aula/laboratorio con estado de ciclo de vida | `code` (único), `name`, `type`, `capacity?`, `status` |
| `TimeSlot` | Turno horario fijo (9 oficiales) | `label`, `startTime`, `endTime`, `order` (único) |
| `Semester` | Semestre académico | `name` (único), fechas, `workingDays Int[]`, `isActive` único |
| `Schedule` | Bloque de la planilla semanal: materia (+docente?) en una celda | `subjectId`, `teacherId?`, `dayOfWeek`, `note?`, `assignedBy` |
| `Reservation` | Reserva operativa con ciclo de vida | `type`, `dayOfWeek?`/`date?`, `timeSlotId`, `status`, `requestedBy`, `resolvedBy?` |
| `Annotation` | Anotación/bitácora de uso de un aula | `date`, `content` |
| `MaintenanceLog` | Reporte de mantenimiento | `date`, `reason`, `status`; abierto = bloquea aula |

Diseño según `PROYECTOMINIMO.md`: las comisiones (`CourseOffering`) fueron **eliminadas**; cada bloque de la planilla referencia directamente materia y docente. Las reservas son independientes de la planilla (uso operativo del espacio) y conviven con ella en la Tabla Semanal.

### Enums

| Enum | Valores |
|------|---------|
| `UserRole` | `ENCARGADO` · `AYUDANTE` |
| `ClassroomType` | `LAB_COMPUTACION` · `LAB_GENERAL` · `AULA` |
| `ClassroomStatus` | `ACTIVA` · `INACTIVA` · `EN_MANTENIMIENTO` · `FUERA_SERVICIO` |
| `ReservationType` | `RECURRENTE` · `PUNTUAL` |
| `ReservationStatus` | `PENDIENTE` · `CONFIRMADA` · `CANCELADA` |
| `MaintenanceStatus` | `REPORTADO` · `EN_PROGRESO` · `COMPLETADO` |

### Restricciones de unicidad e integridad (a nivel BD)

| Constraint | Garantía | Violación → error API |
|-----------|----------|----------------------|
| `@@unique([classroomId, semesterId, dayOfWeek, timeSlotId])` en `Schedule` | **Una celda de la planilla = un bloque** | `409 RESERVATION_CONFLICT` |
| Índice parcial único sobre `Semester(isActive) WHERE isActive` | **Un solo semestre activo**, garantizado por BD | `409 CONFLICT` |
| `code` únicos en `Teacher`, `Subject`, `Classroom`; emails únicos en `User`, `Teacher` | Catálogos sin duplicados | Códigos específicos (`*_IN_USE`) |

Las reservas **no** tienen constraint de unicidad: la ocupación se resuelve en servicio contra schedules + reservas activas dentro de transacciones.

---

## Reglas de negocio (ocupación)

Implementadas transaccionalmente en `slotAvailability.service.ts`:

1. **Aula disponible** — `status = "ACTIVA"` **y** sin mantenimientos abiertos; caso contrario → `409 CLASSROOM_UNAVAILABLE`.
2. **Una celda = un ocupante** — al crear/editar un horario o crear una reserva se verifica contra:
   - `Schedule` en esa celda → `409 RESERVATION_CONFLICT`
   - Reserva RECURRENTE activa (`PENDIENTE`/`CONFIRMADA`) en ese día+turno → idem
   - Reserva PUNTUAL activa cuya fecha cae en ese día del semestre (choque inverso: la fecha puntual también bloquea su celda semanal) → idem
3. **Docente libre** — un docente no puede estar en dos aulas el mismo día+turno (solo aplica a bloques de la planilla) → `409 TEACHER_CONFLICT`.
4. **Días hábiles** — `dayOfWeek` debe estar en `semester.workingDays` (y nunca domingo) → `400 NON_WORKING_DAY`.
5. **Rango semestral** — toda reserva PUNTUAL debe caer dentro de `[startDate, endDate]` del semestre → `400 DATE_OUTSIDE_SEMESTER`.
6. **Catálogos inactivos no asignables** — materias/docentes con `active=false` no entran en horarios nuevos → `400 INACTIVE_CATALOG_ITEM`.

### Ciclo de vida de una reserva

```
                    ┌────────────────────────────────────────────┐
POST /reservations  │  PENDIENTE ──(confirmar ENCARGADO*)──► CONFIRMADA
crea en PENDIENTE   │      │  │                                     │
                    │      │  └──(cancela dueño†)──┐                │
                    │      └─────(cancela ENCARGADO)├──► CANCELADA ◄─┘ (cancelar)
                    └────────────────────────────────────────────┘
* confirma solo si la celda sigue libre (revalidación).
† un Ayudante cancela la propia solo mientras está PENDIENTE.
CANCELADA es terminal. Edición (PATCH): dueño mientras PENDIENTE;
ENCARGADO salvo CANCELADA. El tipo (RECURRENTE/PUNTUAL) es inmutable.
```

7. **Sincronización automática aula ↔ mantenimiento** — crear reporte → aula `EN_MANTENIMIENTO` (si estaba `ACTIVA`); completar/eliminar el último abierto → vuelve a `ACTIVA`. Nunca toca `INACTIVA`/`FUERA_SERVICIO`.
8. **Un solo semestre activo** — garantizado por índice parcial único; `activateSemester` desactiva todos y activa uno en transacción.
9. **Borrado lógico** para catálogos (`active=false`, aulas `INACTIVA`); físico para schedules, anotaciones y reservas ya `CANCELADA` (limpieza ENCARGADO).
10. **Contraseñas**: bcrypt salt 12, `passwordHash` jamás se expone. **JWT**: expira en 12h; el rol siempre se lee de BD.
11. **Transacciones con timeout ampliado** (`30s`/`maxWait 10s`): contra Neon las validaciones anti-conflicto superan el default de 5s.

---

## Autenticación y permisos

- **Login**: `POST /api/auth/login` con `{ email, password }` → `{ data: { token, user } }`.
- **Sesión**: `Authorization: Bearer <token>` en toda ruta autenticada. Sin/inválido → `401`.
- `requireAuth` carga el usuario desde BD y rechaza desactivados. `requireRole("ENCARGADO")` → `403 FORBIDDEN`.

### Matriz de acceso por endpoint

| Acceso | Endpoints |
|--------|-----------|
| **PÚBLICO** | `GET /api/health` · `POST /api/auth/login` |
| **AUTENTICADO** | Lecturas de catálogos y recursos · `GET /api/schedules` · `GET /api/reservations`¹ · `POST /api/reservations` · `PATCH /api/reservations/:id`² · `PATCH /api/reservations/:id/status`³ · `GET /api/classrooms/:id/state` · `GET /api/availability/grid` · `POST /api/schedules`⁴ · `PATCH/DELETE /api/schedules/:id`⁴ · `POST /api/annotations` · `DELETE /api/annotations/:id`⁵ · `POST /api/maintenance` |
| **ENCARGADO** (solo) | CRUD `/users`, `/subjects`, `/teachers`, `/time-slots` · `POST/PATCH/DELETE /classrooms` · `POST/PATCH /semesters` · `POST /semesters/:id/activate` · `PATCH/DELETE /maintenance/:id` · `DELETE /reservations/:id`⁶ |

1. El Ayudante solo ve **sus propias** reservas; el Encargado ve todas (filtros por `status/classroomId/semesterId/type`).
2. Edición: dueño mientras `PENDIENTE`; Encargado salvo `CANCELADA`.
3. Confirmar/cancelar: Encargado cualquier transición válida; Ayudante dueño solo cancelar mientras `PENDIENTE`.
4. En schedules, un Ayudante edita/elimina solo los que él creó.
5. Anotaciones: autor o Encargado.
6. Borrado físico de reservas ya `CANCELADA`.

> **Rate limiting** (`express-rate-limit`):
> - Global sobre todo `/api`: **300 requests por IP cada 15 min** (exceptúa `/health` y `/openapi.json`).
> - Login: **20 intentos por IP cada 15 min**.
> - Al superar cualquiera → `429 RATE_LIMIT_EXCEEDED`.

---

## Contrato de la API

### Convenciones generales

- **Base URL**: `http://localhost:3001/api`.
- **Éxito**: `{ "data": ... }`. Listas paginadas: `{ data: [...], meta: { page, pageSize, total, totalPages } }` (users, classrooms, subjects, teachers, semesters, reservations, annotations, maintenance). Excepciones sin paginar: `{ data: TimeSlot[] }` (turnos), `{ data: Schedule[] }` (schedules), grilla y stats con objetos propios.
- **Eliminaciones**: `204 No Content` (sin body).
- **Errores**: `{ "error": { "code", "message", "details?" } }`.
- **Fechas**: ISO 8601 UTC; entrada acepta `YYYY-MM-DD`. `dayOfWeek`: 1=Lunes … 6=Sábado.
- Enums viajan como strings exactas (`"PENDIENTE"`, `"RECURRENTE"`, `"OCUPADA"`, …).
- **Documentación interactiva**: UI Scalar en `/api/docs` y spec cruda en `/api/openapi.json`, ambas servidas por la app.

### Catálogo de códigos de error

| Código | HTTP | Cuándo |
|--------|------|--------|
| `VALIDATION_ERROR` | 400 | Body/query/params no cumplen Zod (`details` por campo) |
| `CANNOT_DELETE_SELF` | 400 | Encargado intenta eliminarse a sí mismo |
| `CURRENT_PASSWORD_INVALID` | 400 | Cambio de contraseña con actual incorrecta |
| `INACTIVE_CATALOG_ITEM` | 400 | Materia/docente inactivo usado en horario nuevo |
| `NON_WORKING_DAY` | 400 | Día fuera de `workingDays` del semestre o domingo |
| `DATE_OUTSIDE_SEMESTER` | 400 | Fecha puntual fuera de `[startDate, endDate]` |
| `AUTH_INVALID_CREDENTIALS` | 401 | Login incorrecto |
| `TOKEN_INVALID` / `TOKEN_EXPIRED` | 401 | Token ausente/malformado/vencido |
| `USER_INACTIVE` | 401 | Usuario desactivado |
| `FORBIDDEN` | 403 | Rol insuficiente o no es autor/dueño del recurso |
| `NOT_FOUND` | 404 | Recurso o ruta inexistente (incluye P2025) |
| `RESERVATION_CONFLICT` | 409 | Celda ocupada por schedule u otra reserva activa |
| `TEACHER_CONFLICT` | 409 | Docente ya asignado ese día+turno en otra aula |
| `CLASSROOM_UNAVAILABLE` | 409 | Aula no `ACTIVA` o con mantenimiento abierto |
| `INVALID_RESERVATION_TRANSITION` | 409 | Transición de estado inválida (p.ej. confirmar una CANCELADA) |
| `RESERVATION_NOT_EDITABLE` | 409 | La reserva ya no está PENDIENTE para su editor |
| `EMAIL_IN_USE` · `CLASSROOM_CODE_IN_USE` · `SUBJECT_CODE_IN_USE` · `TEACHER_CODE_IN_USE` · `TEACHER_EMAIL_IN_USE` · `TIME_SLOT_ORDER_IN_USE` | 409 | Unicidad de catálogos |
| `SEMESTER_HAS_DEPENDENCIES` | 409 | Semestre con horarios o reservas no se elimina |
| `SEMESTER_ACTIVE` | 409 | No se elimina el semestre activo |
| `TIME_SLOT_IN_USE` | 409 | Turno con horarios asociados |
| `USER_HAS_DEPENDENCIES` | 409 | Usuario con registros asociados |
| `CONFLICT` | 409 | Unicidad P2002 no clasificada o referencia inexistente (P2003) |
| `RATE_LIMIT_EXCEEDED` | 429 | Límite global o de login superado |
| `SERVICE_UNAVAILABLE` | 503 | BD caída en health check |
| `INTERNAL_ERROR` | 500 | Error no controlado |

### Tipos de respuesta (fuente de verdad: `src/types/index.ts`)

```ts
type UserRole = "ENCARGADO" | "AYUDANTE";
type ClassroomType = "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA";
type ClassroomStatus = "ACTIVA" | "INACTIVA" | "EN_MANTENIMIENTO" | "FUERA_SERVICIO";
type ReservationType = "RECURRENTE" | "PUNTUAL";
type ReservationStatus = "PENDIENTE" | "CONFIRMADA" | "CANCELADA";
type MaintenanceStatus = "REPORTADO" | "EN_PROGRESO" | "COMPLETADO";
type ClassroomAvailabilityState = "LIBRE" | "OCUPADA" | "MANTENIMIENTO";

interface Schedule {
  id: string; classroomId: string; classroom: { id; code; name };
  semesterId: string;
  subjectId: string; subject: { id; code; name };
  teacherId: string | null; teacher: { id; code; name } | null;
  dayOfWeek: number; timeSlotId: string; timeSlot: TimeSlot;
  note: string | null; assignedById: string; assignedBy: { id; name };
  updatedAt: string;
}

interface Reservation {
  id: string; classroomId: string; classroom: { id; code; name };
  semesterId: string; type: ReservationType;
  dayOfWeek: number | null;          // RECURRENTE
  date: string | null;               // PUNTUAL (medianoche UTC)
  timeSlotId: string; timeSlot: TimeSlot;
  status: ReservationStatus; note: string | null;
  requestedById: string; requestedBy: { id; name };
  resolvedById: string | null; resolvedBy: { id; name } | null;
  createdAt: string; updatedAt: string;
}

interface ClassroomStateResult {
  classroomId: string; classroom: { id; code; name };
  date: string; dayOfWeek: number; timeSlotId: string;
  state: ClassroomAvailabilityState;
  reason?: string;
  occupiedBy?: { kind: "SCHEDULE"; schedule: Schedule }
             | { kind: "RESERVATION"; reservation: Reservation };
}

// Grilla semanal: matriz workingDays × timeSlots por aula
interface AvailabilityGridCell {
  dayOfWeek: number; timeSlotId: string;
  entry: null
    | { kind: "SCHEDULE"; scheduleId: string; subject: {id;code;name}; teacher: {id;code;name} | null }
    | { kind: "RESERVATION"; reservationId: string; type: ReservationType; status: ReservationStatus; date: string | null };
}
interface AvailabilityGridClassroom {
  classroom: { id; code; name };
  maintenance: Array<{ id; date; reason; status: MaintenanceStatus }>;
  cells: AvailabilityGridCell[];
}

interface StatsOverview {
  totalClassrooms: number;
  classroomsByType: { type: ClassroomType; count: number }[];
  activeSemester: { id: string; name: string } | null;
  occupancyByClassroom: { classroom: {id;code;name}; occupiedSlots: number; totalSlots: number; percentage: number }[];
  pendingMaintenance: number;
  reservationsByStatus: { status: ReservationStatus; count: number }[];
}
```

---

## Endpoints — detalle

#### Autenticación

- **`POST /auth/login`** `{ email, password }` → `200 {data:{token, user}}` · `401 AUTH_INVALID_CREDENTIALS|USER_INACTIVE` · `429`.
- **`GET /auth/me`** · **`PATCH /auth/me`** · **`PATCH /auth/me/password`**.

#### Usuarios, aulas, materias, docentes, turnos, semestres

CRUD estándar según matriz de acceso. Detalles relevantes:

- **Aulas**: soft delete → `status INACTIVA`. `PATCH /classrooms/:id` acepta `status`. Nuevo: **`GET /classrooms/:id/state?date=&timeSlotId=`** (ver Disponibilidad).
- **Semestres**: `POST/PATCH` aceptan `workingDays?: number[]` (1–6, sin duplicados). `DELETE` falla con `SEMESTER_HAS_DEPENDENCIES` si tiene horarios o reservas; el activo no se elimina (`SEMESTER_ACTIVE`). `POST /semesters/:id/activate` en transacción.
- **Turnos**: CRUD ENCARGADO con validación de orden único y borrado bloqueado si está en uso.
- **Materias/Docentes**: baja lógica (`active=false`); inactivos no asignables a horarios nuevos.

#### Schedules (planilla semanal — §4.3 del doc base)

**`GET /schedules?classroomId=&semesterId=`** (ambos requeridos) → `200 {data: Schedule[]}` ordenado por día y turno.

**`POST /schedules`** — body: `{classroomId, semesterId, subjectId, teacherId?, dayOfWeek, timeSlotId, note?}`. Validaciones dentro de transacción: turno/semestre/aula existen (`404`), aula disponible (`409 CLASSROOM_UNAVAILABLE`), catálogos activos (`400 INACTIVE_CATALOG_ITEM`), día hábil del semestre (`400 NON_WORKING_DAY`), celda libre vs schedules+reservas (`409 RESERVATION_CONFLICT`) y docente libre ese día+turno (`409 TEACHER_CONFLICT`). Unicidad BD como red de seguridad (P2002 → `RESERVATION_CONFLICT`).

> Se puede planificar en **cualquier semestre** (activo o no); el chequeo de semestre activo solo aplica al estado en tiempo real del aula.

**`PATCH /schedules/:id`** — parcial; re-ejecuta las validaciones solo sobre campos cambiados (excluyéndose a sí mismo de los conflictos). Autor o ENCARGADO.

**`DELETE /schedules/:id`** — físico. Autor o ENCARGADO.

#### Reservas (§5.2 y §4.5 del doc base)

**`GET /reservations?status=&classroomId=&semesterId=&type=&page=&pageSize=`**
- Ayudante: solo las propias. Encargado: todas. Orden `createdAt desc`.

**`GET /reservations/:id`** — dueño o Encargado.

**`POST /reservations`** — crea en `PENDIENTE`:
```json
{ "classroomId": "cls-d404", "semesterId": "sem-2026-a",
  "type": "RECURRENTE",   "dayOfWeek": 3,            "timeSlotId": "ts-5" }
{ "classroomId": "cls-d404", "semesterId": "sem-2026-a",
  "type": "PUNTUAL", "date": "2026-11-20",           "timeSlotId": "ts-5" }
```
- RECURRENTE exige `dayOfWeek` (y rechaza `date`); PUNTUAL exige `date` (deriva su weekday; rechaza `dayOfWeek`). Zod valida la forma → `400 VALIDATION_ERROR`.
- Negocio (transacción): semestre/aula/turno válidos, aula disponible, día hábil, fecha en rango (puntual) y celda libre → `409 RESERVATION_CONFLICT` / `400 NON_WORKING_DAY` / `400 DATE_OUTSIDE_SEMESTER`.

**`PATCH /reservations/:id`** — cambia `classroomId`, `timeSlotId`, `dayOfWeek`, `date`, `note` (nunca `type` ni `status`). Revalida ocupación de la celda destino. Dueño mientras `PENDIENTE`; Encargado salvo `CANCELADA` → `409 RESERVATION_NOT_EDITABLE` / `403 FORBIDDEN`.

**`PATCH /reservations/:id/status`** — `{ status: "CONFIRMADA" | "CANCELADA" }`:
- `CONFIRMADA` solo desde `PENDIENTE` y **revalidando disponibilidad** (si alguien ocupó la celda mientras tanto → `409 RESERVATION_CONFLICT`).
- `CANCELADA` desde `PENDIENTE` o `CONFIRMADA`; estado terminal.
- Transición inválida → `409 INVALID_RESERVATION_TRANSITION`.
- Permisos: Encargado cualquier transición; Ayudante dueño solo cancelar suya en `PENDIENTE`.

**`DELETE /reservations/:id`** — ENCARGADO; solo reservas ya `CANCELADA` (limpieza). `204`.

#### Disponibilidad (§5.4 y §7 del doc base)

**`GET /classrooms/:id/state?date=&timeSlotId=`** — estado puntual de un aula.
- Defaults: hoy + turno actual autodetectado por hora (fuera de rango → `400 VALIDATION_ERROR` pidiendo `timeSlotId` explícito).
- Prioridad de evaluación: domingo → `LIBRE` (razón) · aula no `ACTIVA` → `MANTENIMIENTO` · mantenimiento abierto → `MANTENIMIENTO` · schedule del semestre activo → `OCUPADA (kind=SCHEDULE)` · reserva activa recurrente/puntual ese día → `OCUPADA (kind=RESERVATION)` · resto `LIBRE`.

**`GET /availability/grid?semesterId=&classroomId=&includePuntual=true`** — Tabla Semanal completa:
```json
{ "data": { "semester": {"id","name","workingDays","startDate","endDate"},
  "timeSlots": [ ... 9 turnos ... ],
  "classrooms": [ { "classroom": {...}, "maintenance": [...],
    "cells": [ { "dayOfWeek": 1, "timeSlotId": "ts-1", "entry": null |
      { "kind": "SCHEDULE", "scheduleId", "subject", "teacher" } |
      { "kind": "RESERVATION", "reservationId", "type", "status", "date" } } ] } ] } }
```
- Celdas solo para los días hábiles del semestre. `includePuntual=false` excluye reservas puntuales. Aulas `INACTIVA` excluidas salvo filtrado por `classroomId`.

#### Anotaciones, Mantenimiento y Stats

- **`GET /annotations?classroomId=&from=&to=`** · **`POST /annotations`** `{classroomId, content}` · **`DELETE /annotations/:id`** (autor o Encargado).
- **Mantenimiento**: `GET /maintenance?classroomId=&status=` · `POST` (crea `REPORTADO`, aula → `EN_MANTENIMIENTO`, bloquea reservas §8) · `PATCH /:id {status}` (solo Encargado; al quedar sin abiertos, aula → `ACTIVA`) · `DELETE /:id`.
- **`GET /stats/overview`** → `StatsOverview` (ver tipos). `reservationsByStatus` incluye solo estados con al menos una reserva. Ocupación = bloques de planilla del semestre activo sobre `totalSlots = turnos × 6` (constante `DAYS_PER_WEEK`; no deriva de `workingDays`). Porcentaje redondeado a 2 decimales; sin semestre activo, todo en 0.

#### Salud

**`GET /health`** — público:
- BD accesible → `200 { data: { status: "ok", db: "up", uptime } }`.
- BD caída → `503 { data: { status: "degraded", db: "down", uptime } }`.

---

## Verificación (smoke test)

La suite automatizada (Vitest) fue retirada durante la realineación; el contrato se verifica con un smoke test manual contra el build compilado:

```bash
npm run build && npm start
```

Checklist (14 checks, todos ejecutados y en verde tras la realineación):

1. `GET /api/health` → `db: up`
2. Login admin y ayudante → tokens
3. Ayudante crea reserva RECURRENTE en celda libre → `201 PENDIENTE`
4. Misma celda otra vez → `409 RESERVATION_CONFLICT`
5. Admin confirma → `CONFIRMADA`; ayudante confirma ajena → `403 FORBIDDEN`
6. `POST /schedules` sobre esa celda confirmada → `409 RESERVATION_CONFLICT`
7. `GET /classrooms/:id/state` → `OCUPADA` por `RESERVATION`
8. `GET /availability/grid` → 8 aulas, celdas pobladas (>100)
9. PUNTUAL válida → `201`; fecha fuera del semestre → `400 DATE_OUTSIDE_SEMESTER`; domingo → `400 NON_WORKING_DAY`
10. `GET /api/course-offerings` → `404` (endpoint eliminado)

> Ejecutar contra base de desarrollo: los pasos crean reservas que luego se cancelan y borran al final del script.

---

## Datos maestros configurables (`prisma/seed.config.ts`)

El seed no inventa datos: importa todo de `seed.config.ts`, que la institución edita sin tocar lógica.

| Export | Contenido |
|--------|-----------|
| `TIME_SLOTS` | 9 turnos oficiales (`ts-1` … `ts-9`) |
| `CLASSROOMS` | 8 aulas (`D201`, `D302`, `D304`, `E112`, `D401`–`D404`) |
| `SEMESTER` | `2026-A` (2026-08-01 → 2026-12-18), `workingDays: [1..6]` |
| `TEACHERS` | 30 docentes (código slug del apellido; `INGLES` agrupa cátedras) |
| `SUBJECTS` | 32 materias (`DD111`, `MO211`, … + `INGLES`, `EXCEL`, `AULA-COMUN`) |
| `BLOCKS` | **110 bloques reales**: `{ classroomCode, dayOfWeek, timeSlotOrder, subjectCode, teacherCode? }` |
| `ADMIN` / `AYUDANTES` | `admin@institucion.edu` / `admin123` (ENCARGADO) + 4 ayudantes (`ayudante123`) |

Comportamiento:

- **Idempotente**: upserts sobre catálogos y bloques (clave compuesta `classroomId_semesterId_dayOfWeek_timeSlotId`). Re-ejecutar no duplica ni borra datos operacionales.
- **Valida antes de escribir**: referencias existentes, celdas únicas por aula y **docente sin dobles turnos entre aulas** — un dataset inválido aborta el seed con mensaje explícito.
- Verifica conteos finales (aulas/docentes/materias/turnos/bloques).
- El admin re-hashea su contraseña en cada run.
- Los `id` son estables (`cls-d302`, `tea-soria`, `sub-dd111`, …).

---

## Notas de implementación

1. **Reglas compartidas**: `slotAvailability.service.ts` exporta primitivas (`assertRecurringSlotAvailable`, `assertPunctualSlotAvailable`, `assertNoTeacherConflict`, `assertClassroomBookable`, etc.) usadas por schedules **y** reservations; ninguna operación escribe sin pasar por ellas dentro de `$transaction(TX_OPTIONS)` (`timeout 30s / maxWait 10s` — necesario por latencia Neon).
2. **Choque inverso puntual↔semanal**: una reserva puntual bloquea su día+turno para toda la semana (si ese día está en `workingDays`) y viceversa: un bloque semanal impide puntuales en cualquier fecha de ese weekday.
3. **Confirmación con revalidación**: confirmar una reserva vuelve a correr las verificaciones de ocupación; evita doble ocupación si dos pendientes se crearon antes de que la lógica lo impidiera o si llegó un schedule entre medio.
4. **Conflictos P2002**: mapeo por `meta.target` (`utils/dbErrors.ts`) → la unicidad de la celda del schedule produce `409 RESERVATION_CONFLICT`. Los conflictos de docente se detectan por query previa, no por constraint.
5. **Estado del aula vs semestre activo**: se permite planificar/reservar en cualquier semestre; el estado en tiempo real (`/:id/state`) evalúa solo el activo.
6. **Zod 4**: sintaxis `z.email()`; validación condicional recurrente/puntual con `superRefine`.
7. **Login anti-enumeración**: bcrypt dummy cuando el email no existe.
8. **JWT**: solo lleva `sub`; el rol se lee de BD en cada request.

---

## Realineación al documento base (2026-08)

Implementación completa de [`PLAN_REALINEACION_MODELO.md`](./PLAN_REALINEACION_MODELO.md), migración regenerada desde cero (`20260823065113_init`).

### Antes → Después

| Concepto | Antes | Después |
|----------|-------|---------|
| Bloque de horario | Referenciaba una comisión (`courseOfferingId`) obligatoria | Materia + docente directos (`subjectId`, `teacherId?`) |
| Comisión | `CourseOffering` (semestre+materia+sección+docente) | **Eliminada** |
| Reservas | No existían | `Reservation` con ciclo de vida PENDIENTE→CONFIRMADA/CANCELADA, RECURRENTE/PUNTUAL |
| Disponibilidad | Inexistente | `GET /classrooms/:id/state` + `GET /availability/grid` |
| Días hábiles | Fijos L–S | Configurables por semestre (`workingDays`) |

### Checklist breaking para el frontend (`labmanage-web`)

- [ ] Eliminar selects de comisión: el formulario de bloques ahora envía `subjectId` + `teacherId?` directos.
- [ ] Nueva pantalla de reservas: crear (ayudante), confirmar/cancelar (encargado), filtros por estado.
- [ ] Consumir `GET /availability/grid` para la Tabla Semanal y `GET /classrooms/:id/state` para el estado Libre/Ocupada/Mantenimiento.
- [ ] Actualizar `web/src/lib/types.ts` con los tipos de este README (ya no existen `CourseOffering*`; nuevos `Reservation`, `ClassroomStateResult`, grilla).
- [ ] Manejar los nuevos errores: `NON_WORKING_DAY`, `DATE_OUTSIDE_SEMESTER`, `INVALID_RESERVATION_TRANSITION`, `RESERVATION_NOT_EDITABLE`.
- [ ] Semestres: agregar editor de `workingDays`.

---

## Despliegue (referencia)

- **BD**: Neon (producción).
- **API**: Railway o Render — Node 20, `npm install && npx prisma migrate deploy && npm run build && npm start`.
- **Web**: Vercel/Netlify — build estático de Astro con `PUBLIC_API_URL` apuntando a la API desplegada.