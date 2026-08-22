# LABMANAGE API

Backend REST de **LABMANAGE**, sistema de gestión de aulas/laboratorios: disponibilidad, uso y estados de las aulas de una institución.

Este proyecto es la **API** que administra la base de datos. El frontend (`labmanage-web`, Astro + React) **solo** consume esta API a través de HTTP/JSON con autenticación JWT.

> **Fuente de verdad**: el contrato original vive en [`PLAN.md`](../PLAN.md) (secciones 5–8); la migración al modelo normalizado en [`PLAN_MIGRACION_MODELO_DATOS.md`](../PLAN_MIGRACION_MODELO_DATOS.md) y [`NORMALIZACION_MODELO_DATOS.md`](../NORMALIZACION_MODELO_DATOS.md). Este README documenta el **comportamiento real** de la implementación actual y prevalece sobre esos documentos ante cualquier divergencia.

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
| Seguridad | Helmet · CORS · rate limiting en login (`express-rate-limit`) · body limit 1 MB |
| Testing | Vitest + Supertest |

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
│   ├── seed.config.ts       # Datos maestros editables por la institución
│   ├── seed.ts              # Seed idempotente (upsert)
│   └── migrations/          # Migraciones versionadas
├── src/
│   ├── index.ts             # Arranque del servidor (app.listen)
│   ├── app.ts               # Express: helmet, cors, json, router /api, errorHandler
│   ├── config/env.ts        # Variables de entorno tipadas (valida que existan)
│   ├── lib/prisma.ts        # Instancia única de PrismaClient
│   ├── middleware/
│   │   ├── auth.ts          # requireAuth, requireRole (adjunta req.user)
│   │   ├── validate.ts      # Validación Zod genérica (body | query | params)
│   │   ├── rateLimit.ts     # Rate limiter de login (factory testeable)
│   │   └── errorHandler.ts  # Traduce Zod y errores Prisma al formato { error }
│   ├── routes/              # Definen endpoints, middlewares y validación Zod
│   ├── services/            # Lógica de negocio (permisos, conflictos, transacciones)
│   ├── types/index.ts       # Tipos de respuesta compartidos (fuente de verdad)
│   └── utils/               # errors.ts (ApiErrors) · dbErrors.ts (parseo de P2002) · serializers.ts (toPublicUser)
└── tests/                   # Suites de test por recurso
```

### Flujo de una petición

```
Request ─► helmet/cors/express.json ─► /api ─► routes (validación Zod) ─► services (lógica) ─► Prisma ─► Neon
                                                                                              │
                                                     errorHandler ◄──── error (Zod / ApiError / Prisma)
                                                                                              │
                                                                                    { error: {...} } ◄──── 400/401/403/404/409/500
```

Reglas de capas (obligatorias):

- **`routes/*.routes.ts`** — definen el endpoint, aplican `requireAuth`/`requireRole`, validan con Zod y delegan al service. **Nunca** contienen lógica de negocio.
- **`services/*.service.ts`** — lógica de negocio (conflictos de celda, transacciones, permisos de autor, estados). Solo aquí se toca Prisma.
- **`middleware/errorHandler.ts`** — traduce `ZodError` → 400 `VALIDATION_ERROR`, `ApiError` → su código, y errores Prisma `P2002` → 409, `P2025`/`P2003` → 404.

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

> `npx prisma migrate deploy` se usa en producción.

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Arranca con `tsx watch` (recarga en caliente) |
| `npm run build` | Compila TypeScript a `dist/` (`tsc`) |
| `npm start` | Ejecuta el build (`node dist/index.js`) |
| `npm run prisma:seed` | Carga/actualiza los datos maestros desde `seed.config.ts` |
| `npm test` | Ejecuta todos los tests con Vitest |
| `npm run test:watch` | Ejecuta tests en modo watch |

---

## Modelo de datos

Esquema completo en `prisma/schema.prisma`. Nueve modelos organizados en **catálogos**, **operación** y **bitácora**:

| Modelo | Descripción | Campos clave | Relaciones |
|--------|-------------|--------------|------------|
| `User` | Usuario del sistema (encargado/ayudante) | `email` (único), `passwordHash`, `role`, `active` | `schedules`, `annotations`, `maintenance` |
| `Teacher` | Docente del catálogo académico | `code` (único), `name`, `email?` (único), `active` | `offerings` |
| `Subject` | Materia del catálogo académico | `code` (único), `name`, `active` | `offerings` |
| `CourseOffering` | Comisión: materia+docente+sección en un semestre | `section`, `type`, `active`, `note?` | `semester`, `subject`, `teacher?`, `schedules` |
| `Classroom` | Aula/laboratorio con estado de ciclo de vida | `code` (único), `name`, `type`, `capacity?`, `location?`, `status` | `schedules`, `annotations`, `maintenance` |
| `TimeSlot` | Turno horario fijo | `label`, `startTime`, `endTime`, `order` (único) | `schedules` |
| `Semester` | Semestre académico | `name` (único), `startDate`, `endDate`, `isActive` | `schedules`, `offerings` |
| `Schedule` | Bloque del grid (reserva) que referencia una comisión | `dayOfWeek`, `note?` | `classroom`, `semester`, `timeSlot`, `courseOffering`, `assignedBy` |
| `Annotation` | Anotación/bitácora de un aula | `date`, `content` | `classroom`, `user` |
| `MaintenanceLog` | Reporte de mantenimiento | `date`, `reason`, `status` | `classroom`, `createdBy` |

> **Cambio de modelo (migración normalizada)**: `Schedule` ya **no** tiene `type`, `title` ni `teacher` como texto libre. Todo bloque apunta a una `CourseOffering` que aporta materia, docente, sección y tipo. `Classroom.active` fue reemplazado por `status`.

### Enums

| Enum | Valores |
|------|---------|
| `UserRole` | `ENCARGADO` · `AYUDANTE` |
| `ClassroomType` | `LAB_COMPUTACION` · `LAB_GENERAL` · `AULA` |
| `ClassroomStatus` | `ACTIVA` · `INACTIVA` · `EN_MANTENIMIENTO` · `FUERA_SERVICIO` |
| `CourseOfferingType` | `CLASE` · `EXTRACURRICULAR` · `ACTIVIDAD` |
| `MaintenanceStatus` | `REPORTADO` · `EN_PROGRESO` · `COMPLETADO` |

### Restricciones de unicidad e integridad (a nivel BD)

| Constraint | Garantía | Violación → error API |
|-----------|----------|----------------------|
| `@@unique([classroomId, semesterId, dayOfWeek, timeSlotId])` en `Schedule` | **Una celda = un bloque**: no hay dos reservas en el mismo hueco del grid | `409 RESERVATION_CONFLICT` |
| `@@unique([courseOfferingId, dayOfWeek, timeSlotId])` en `Schedule` | **Una comisión no está en dos aulas simultáneas** | `409 OFFERING_CONFLICT` |
| `@@unique([semesterId, subjectId, section, teacherId])` en `CourseOffering` | No existen comisiones duplicadas; permite comisiones paralelas con distinto docente | `409 OFFERING_ALREADY_EXISTS` |
| Índice parcial único sobre `Semester(isActive) WHERE isActive` | **Un solo semestre activo**, garantizado por la BD misma | `409 CONFLICT` |
| `code` únicos en `Teacher`, `Subject`, `Classroom`; `email` únicos en `User`, `Teacher` | Identidades de catálogo sin duplicados | Códigos específicos (`*_IN_USE`) |

### Regla de disponibilidad de aula

Un bloque solo puede crearse/editarse hacia un aula cuyo `status = "ACTIVA"` **y** que no tenga mantenimientos abiertos (`status != COMPLETADO`). Caso contrario → `409 CLASSROOM_UNAVAILABLE`. El mantenimiento ya no es un tipo de schedule: es un proceso aparte que sincroniza automáticamente el estado del aula (ver [Reglas de negocio](#reglas-de-negocio)).

---

## Reglas de negocio

1. **Una celda = un bloque** — constraint sobre `(classroomId, semesterId, dayOfWeek, timeSlotId)` → `409 RESERVATION_CONFLICT`.
2. **Una comisión = un lugar a la vez** — `(courseOfferingId, dayOfWeek, timeSlotId)` → `409 OFFERING_CONFLICT`. El docente de la comisión tampoco puede estar en dos aulas simultáneas → `409 TEACHER_CONFLICT` (validado en servicio dentro de la misma transacción).
3. **Coincidencia semestre ↔ comisión** — un schedule solo puede crearse en el semestre de su comisión → `400 SEMESTER_MISMATCH`.
4. **Aula disponible** — `status = ACTIVA` y sin mantenimiento abierto; si no, `409 CLASSROOM_UNAVAILABLE`. Las aulas `INACTIVA`, `EN_MANTENIMIENTO` o `FUERA_SERVICIO` no aceptan reservas nuevas.
5. **Catálogos inactivos no asignables** — materias, docentes o comisiones con `active=false` no pueden usarse en horarios ni comisiones nuevos → `400 INACTIVE_CATALOG_ITEM` (los bloques existentes se preservan).
6. **Sincronización automática aula ↔ mantenimiento** (transaccional):
   - Crear reporte (`REPORTADO`) → aula pasa a `EN_MANTENIMIENTO` (si estaba `ACTIVA`).
   - Completar o eliminar el último mantenimiento abierto → aula vuelve a `ACTIVA`.
   - El estado también puede fijarse manualmente (`PATCH /classrooms/:id` con `status`); la sincronización nunca sobrescribe `INACTIVA`/`FUERA_SERVICIO`.
7. **Un solo semestre activo** a la vez — garantizado por índice parcial único en BD; `activateSemester` desactiva todos y activa el elegido en una transacción.
8. **Permisos**:
   - `ENCARGADO`: todo — gestión de usuarios, catálogos académicos (materias/docentes/comisiones), aulas, semestres, estados de mantenimiento.
   - `AYUDANTE`: ver todo; crear/editar/eliminar **sus propios** schedules; crear sus anotaciones; crear reportes de mantenimiento (no cambia su estado). No gestiona catálogos.
9. **Contraseñas**: `bcryptjs` salt 12; `passwordHash` nunca se expone.
10. **JWT**: expiración 12h; el rol siempre se lee de BD (tokens viejos no conservan privilegios).
11. **Borrado lógico** de aulas (`status=INACTIVA`), usuarios, docentes, materias y comisiones (`active=false`); físico para schedules y anotaciones.
12. **Validación Zod** en todos los `body`/`query`/`params` → `400 VALIDATION_ERROR` con `details` estructurados.
13. **Errores**: formato uniforme `{ "error": { "code", "message", "details?" } }` (catálogo completo más abajo).
14. **Fecha de mantenimiento**: `date` es día calendario, normalizado a UTC medianoche (`YYYY-MM-DD` o ISO).
15. **Transacciones con timeout ampliado** (`30s`): las validaciones anti-conflicto corren dentro de transacciones interactivas de Prisma; contra Neon la latencia puede superar el default de 5s.

---

## Autenticación y permisos

- **Login**: `POST /api/auth/login` con `{ email, password }` → devuelve `{ token, user }`.
- **Sesión**: enviar `Authorization: Bearer <token>` en todas las rutas autenticadas. Sin token (o token inválido) → `401`.
- `requireAuth` valida el token, carga el usuario desde BD y **rechaza si el usuario fue desactivado** (`active=false`).
- `requireRole('ENCARGADO')` → `403 FORBIDDEN` si el rol no está permitido.

### Matriz de acceso por endpoint

| Acceso | Endpoints |
|--------|-----------|
| **PÚBLICO** | `GET /api/health` · `POST /api/auth/login` |
| **AUTENTICADO** (encargado o ayudante) | `GET /api/auth/me` · `GET /api/classrooms` · `GET /api/time-slots` · `GET /api/semesters` · `GET /api/subjects` · `GET /api/teachers` · `GET /api/course-offerings` · `GET /api/schedules` · `GET /api/annotations` · `GET /api/maintenance` · `GET /api/stats/overview` · `POST /api/schedules`* · `PATCH/DELETE /api/schedules/:id`* · `POST /api/annotations` · `DELETE /api/annotations/:id`** · `POST /api/maintenance` |
| **ENCARGADO** (solo) | CRUD `/api/users` · CRUD `/api/subjects` · CRUD `/api/teachers` · CRUD `/api/course-offerings` · `POST/PATCH/DELETE /api/classrooms` (incl. cambio de `status`) · `POST/PATCH /api/semesters` · `POST /api/semesters/:id/activate` · `PATCH/DELETE /api/maintenance/:id` |
| **AUTOR del recurso o ENCARGADO** | `PATCH/DELETE /api/schedules/:id` · `DELETE /api/annotations/:id` |

\* Un ayudante puede crear schedules y editar/eliminar **solo los propios**. Ya no existe la restricción por tipo (`MANTENIMIENTO` desapareció como tipo de schedule).
\*\* Un ayudante solo elimina sus propias anotaciones.

> **Rate limiting**: `POST /api/auth/login` está limitado a **20 intentos por IP cada 15 minutos**. Al superarse responde `429 RATE_LIMIT_EXCEEDED`. Durante los tests (`NODE_ENV=test`) el límite se eleva para no interferir con la suite.

---

## Contrato de la API

### Convenciones generales

- **Base URL**: `http://localhost:3001/api` (en producción, la URL desplegada).
- **Auth**: `Authorization: Bearer <token>`.
- **Respuestas de listas**: siempre en un objeto contenedor (`{ users: [...] }`, `{ classrooms: [...] }`, `{ timeSlots: [...] }`, `{ semesters: [...] }`, `{ schedules: [...] }`, `{ annotations: [...] }`, `{ maintenance: [...] }`). Nunca arrays desnudos.
- **Respuestas individuales**: `{ user }`, `{ classroom }`, `{ semester }`, `{ schedule }`, `{ annotation }`, `{ maintenance }`.
- **Eliminaciones (DELETE)**: siempre `{ ok: true }` en 200, para todos los recursos.
- **Búsquedas GET**: filtros opcionales por query string. `?includeInactive=true` solo tiene efecto para rol `ENCARGADO` (el ayudante siempre ve solo activos).
- **Fechas**: serializadas en **ISO 8601** (UTC). `dayOfWeek`: 1=Lunes … 6=Sábado. Horas: `HH:mm`.
- **IDs**: strings opacas (cuid o ids legibles del seed). Los clientes nunca deben parsear su formato.
- **Enums** viajan como strings exactas: `"ENCARGADO"`, `"AYUDANTE"`, `"LAB_COMPUTACION"`, `"LAB_GENERAL"`, `"AULA"`, `"ACTIVA"`, `"INACTIVA"`, `"EN_MANTENIMIENTO"`, `"FUERA_SERVICIO"`, `"CLASE"`, `"EXTRACURRICULAR"`, `"ACTIVIDAD"`, `"REPORTADO"`, `"EN_PROGRESO"`, `"COMPLETADO"`.

### Catálogo de códigos de error

| Código | HTTP | Cuándo |
|--------|------|--------|
| `VALIDATION_ERROR` | 400 | Body/query/params no cumplen Zod; `details` con issues por campo |
| `CANNOT_DELETE_SELF` | 400 | Encargado intenta eliminarse a sí mismo |
| `INACTIVE_CATALOG_ITEM` | 400 | Materia/docente/comisión inactiva usada en horario o comisión nueva |
| `SEMESTER_MISMATCH` | 400 | El semestre del schedule no coincide con el de la comisión |
| `AUTH_INVALID_CREDENTIALS` | 401 | Login con email o contraseña incorrecta |
| `TOKEN_INVALID` | 401 | Token ausente, malformado, de firma inválida, o usuario no encontrado/desactivado |
| `TOKEN_EXPIRED` | 401 | Token vencido (>12h) |
| `USER_INACTIVE` | 401 | Usuario desactivado (`active=false`) intenta autenticarse |
| `FORBIDDEN` | 403 | Rol no permitido o no es el autor del recurso |
| `NOT_FOUND` | 404 | Recurso inexistente, ruta inexistente o referencia inexistente (P2003) |
| `RESERVATION_CONFLICT` | 409 | Celda ya ocupada (aula+semestre+día+turno) |
| `OFFERING_CONFLICT` | 409 | La comisión ya tiene un bloque en ese día/turno (otra aula) |
| `TEACHER_CONFLICT` | 409 | El docente ya dicta en otra aula en ese día/turno |
| `CLASSROOM_UNAVAILABLE` | 409 | El aula no está `ACTIVA` o tiene un mantenimiento abierto |
| `NO_ACTIVE_SEMESTER` | 409 | No existe ningún semestre activo para operar horarios |
| `EMAIL_IN_USE` | 409 | Email duplicado en usuarios |
| `CLASSROOM_CODE_IN_USE` | 409 | Código de aula duplicado |
| `SUBJECT_CODE_IN_USE` | 409 | Código de materia duplicado (también al reusar el de una baja) |
| `TEACHER_CODE_IN_USE` | 409 | Código de docente duplicado |
| `TEACHER_EMAIL_IN_USE` | 409 | Email de docente duplicado |
| `OFFERING_ALREADY_EXISTS` | 409 | Comisión duplicada (semestre+materia+sección+docente) |
| `CONFLICT` | 409 | Otra violación de unicidad `P2002` no clasificada (incluye segundo semestre activo) |
| `RATE_LIMIT_EXCEEDED` | 429 | Supera el límite de intentos de `POST /auth/login` |
| `INTERNAL_ERROR` | 500 | Error no controlado (mensaje genérico, sin stack) |

Formato de respuesta de error (uniforme):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revisá los datos ingresados",
    "details": [{ "field": "email", "message": "Invalid email address" }]
  }
}
```

### Tipos de respuesta

Los tipos de `src/types/index.ts` son la **fuente de verdad** y se reflejan 1:1 en el frontend (`web/src/lib/types.ts`).

```ts
type UserRole = "ENCARGADO" | "AYUDANTE";
type ClassroomType = "LAB_COMPUTACION" | "LAB_GENERAL" | "AULA";
type ClassroomStatus = "ACTIVA" | "INACTIVA" | "EN_MANTENIMIENTO" | "FUERA_SERVICIO";
type CourseOfferingType = "CLASE" | "EXTRACURRICULAR" | "ACTIVIDAD";
type MaintenanceStatus = "REPORTADO" | "EN_PROGRESO" | "COMPLETADO";

interface User { id: string; name: string; email: string; role: UserRole; active: boolean; createdAt: string; updatedAt: string; }        // NUNCA incluye passwordHash
interface Teacher { id: string; code: string; name: string; email: string | null; active: boolean; createdAt: string; updatedAt: string; }
interface Subject { id: string; code: string; name: string; active: boolean; createdAt: string; updatedAt: string; }
interface CourseOfferingSummary {
  id: string; semesterId: string; section: string; type: CourseOfferingType;
  subject: { id: string; code: string; name: string };
  teacher: { id: string; code: string; name: string } | null;
}
interface CourseOffering extends CourseOfferingSummary { note: string | null; active: boolean; createdAt: string; updatedAt: string; }
interface Classroom { id: string; code: string; name: string; type: ClassroomType; capacity: number | null; location: string | null; status: ClassroomStatus; createdAt: string; updatedAt: string; }
interface TimeSlot { id: string; label: string; startTime: string; endTime: string; order: number; }
interface Semester { id: string; name: string; startDate: string; endDate: string; isActive: boolean; }
interface Schedule {
  id: string; classroomId: string; classroom: { id: string; code: string; name: string };
  semesterId: string; dayOfWeek: number; timeSlotId: string;
  timeSlot: TimeSlot; courseOfferingId: string; courseOffering: CourseOfferingSummary;
  note: string | null; assignedById: string; assignedBy: { id: string; name: string }; updatedAt: string;
}
interface Annotation { id: string; classroomId: string; userId: string; user: { id: string; name: string }; date: string; content: string; }
interface MaintenanceLog { id: string; classroomId: string; classroom: { id: string; code: string; name: string }; date: string; reason: string; status: MaintenanceStatus; createdById: string; createdAt: string; }
interface StatsOverview {
  totalClassrooms: number;   // excluye INACTIVA
  classroomsByType: { type: ClassroomType; count: number }[];
  activeSemester: { id: string; name: string } | null;
  occupancyByClassroom: { classroom: { id: string; code: string; name: string }; occupiedSlots: number; totalSlots: number; percentage: number }[];
  pendingMaintenance: number;   // REPORTADO + EN_PROGRESO
}
interface AuthResponse { token: string; user: User; }
```

> **Cambios de contrato para el frontend**: `Classroom.active` → `Classroom.status`; `Schedule.type/title/teacher` → `Schedule.courseOffering { subject, teacher, section, type }`; nuevo campo `Schedule.classroom`.

### Endpoints — detalle

> Ejemplos JSON request/response exactos: ver `PLAN.md` sección 8.4. Los tipos Zod de cada campo se listan aquí; el detalle de cada respuesta sigue los tipos de la sección anterior.

#### Autenticación

**`POST /api/auth/login`** — Público (rate limited)
- Body: `{ email: email().max(254) → lowercased, password: string().min(1).max(100) }`
- **200** `{ token, user }` · **400** `VALIDATION_ERROR` · **401** `AUTH_INVALID_CREDENTIALS` | `USER_INACTIVE` · **429** `RATE_LIMIT_EXCEEDED` (20 intentos/15 min por IP)

**`GET /api/auth/me`** — Autenticado
- **200** `{ user }` · **401** `TOKEN_INVALID` | `TOKEN_EXPIRED`

#### Usuarios (solo ENCARGADO)

**`GET /api/users`** — orden `createdAt` desc, incluye inactivos.
- **200** `{ users: User[] }` · **403** `FORBIDDEN`

**`POST /api/users`**
- Body: `{ name: string().min(2).max(100), email: email().max(254), password: string().min(8).max(100), role: enum("ENCARGADO","AYUDANTE") }`
- **201** `{ user }` · **400** `VALIDATION_ERROR` · **409** `EMAIL_IN_USE`

**`PATCH /api/users/:id`** — body parcial (al menos un campo)
- Body: `{ name?, email?, password?, role?, active? }`
- **200** `{ user }` · **400** `VALIDATION_ERROR` · **404** `NOT_FOUND` · **409** `EMAIL_IN_USE`

**`DELETE /api/users/:id`** — soft delete (`active=false`)
- No puede eliminar el usuario autenticado → **400** `CANNOT_DELETE_SELF`.
- **200** `{ ok: true }` · **400** `CANNOT_DELETE_SELF` · **404** `NOT_FOUND`

#### Aulas

**`GET /api/classrooms`** — Autenticado
- Query opcional: `?includeInactive=true` (solo ENCARGADO ve inactivas) · `?status=ACTIVA|INACTIVA|EN_MANTENIMIENTO|FUERA_SERVICIO` (filtra por estado; `INACTIVA` requiere además `includeInactive=true`).
- **200** `{ classrooms: Classroom[] }` (orden `code` asc) · **401**

**`POST /api/classrooms`** — ENCARGADO
- Body: `{ code: string().min(2).max(20) → uppercase+trim, name: string().min(2).max(100), type: enum(...), capacity?: int().min(1).max(500), location?: string().max(200).nullish() }`
- Se crea con `status: "ACTIVA"`.
- **201** `{ classroom }` · **400** `VALIDATION_ERROR` · **409** `CLASSROOM_CODE_IN_USE`

**`PATCH /api/classrooms/:id`** — ENCARGADO (parcial)
- Body: `{ code?, name?, type?, capacity?, location?, status?: enum("ACTIVA","INACTIVA","EN_MANTENIMIENTO","FUERA_SERVICIO") }`
- El cambio manual de `status` convive con la sincronización automática de mantenimiento: si hay un mantenimiento abierto, completarlo devolverá el aula a `ACTIVA`.
- **200** `{ classroom }` · **400** `VALIDATION_ERROR` · **404** `NOT_FOUND` · **409** `CLASSROOM_CODE_IN_USE`

**`DELETE /api/classrooms/:id`** — ENCARGADO, soft delete (`status → "INACTIVA"`)
- **200** `{ ok: true }` · **404** `NOT_FOUND`

#### Materias (catálogo académico)

**`GET /api/subjects`** — Autenticado
- Query opcional: `?includeInactive=true` (solo ENCARGADO).
- **200** `{ subjects: Subject[] }` (orden `code` asc)

**`GET /api/subjects/:id`** — Autenticado · **200** `{ subject }` · **404** `NOT_FOUND`

**`POST /api/subjects`** — ENCARGADO
- Body: `{ code: string().min(2).max(20) → uppercase+trim, name: string().min(2).max(120) }`
- **201** `{ subject }` · **409** `SUBJECT_CODE_IN_USE`

**`PATCH /api/subjects/:id`** — ENCARGADO (parcial)
- Body: `{ name?, active? }`
- Bajar a `active=false` no afecta bloques existentes, pero impide crear comisiones u horarios nuevos con ella (`400 INACTIVE_CATALOG_ITEM`).
- **200** `{ subject }` · **404** `NOT_FOUND` · **409** `SUBJECT_CODE_IN_USE`

**`DELETE /api/subjects/:id`** — ENCARGADO, baja lógica (`active=false`)
- **200** `{ ok: true }` · **404** `NOT_FOUND`

#### Docentes (catálogo académico)

**`GET /api/teachers`** — Autenticado
- Query opcional: `?includeInactive=true` (solo ENCARGADO). Orden `name` asc.
- **200** `{ teachers: Teacher[] }`

**`GET /api/teachers/:id`** — Autenticado · **200** `{ teacher }` · **404** `NOT_FOUND`

**`POST /api/teachers`** — ENCARGADO
- Body: `{ code: string().min(2).max(30) → uppercase+trim, name: string().min(2).max(120), email?: email().nullish() → lowercased }`
- **201** `{ teacher }` · **409** `TEACHER_CODE_IN_USE` | `TEACHER_EMAIL_IN_USE`

**`PATCH /api/teachers/:id`** — ENCARGADO (parcial)
- Body: `{ name?, email?, active? }`
- Un docente inactivo bloquea horarios nuevos de sus comisiones (`400 INACTIVE_CATALOG_ITEM`) pero no los existentes.
- **200** `{ teacher }` · **404** `NOT_FOUND` · **409** `TEACHER_EMAIL_IN_USE`

**`DELETE /api/teachers/:id`** — ENCARGADO, baja lógica (`active=false`)
- **200** `{ ok: true }` · **404** `NOT_FOUND`

#### Comisiones (course offerings)

Una comisión identifica **qué** se dicta y **quién**: `(semestre, materia, sección, docente?)`. Los bloques del grid siempre la referencian.

**`GET /api/course-offerings?semesterId=&subjectId=&includeInactive=`** — Autenticado
- `semesterId` requerido; `subjectId` e `includeInactive` (solo ENCARGADO) opcionales.
- **200** `{ offerings: CourseOffering[] }` (orden `subject.code`, luego `section`)

**`GET /api/course-offerings/:id`** — Autenticado · **200** `{ offering }` · **404** `NOT_FOUND`

**`POST /api/course-offerings`** — ENCARGADO
- Body: `{ semesterId, subjectId, section: string().min(1).max(20) → uppercase+trim, teacherId?: string.nullish(), type?: enum("CLASE","EXTRACURRICULAR","ACTIVIDAD") (default "CLASE"), note?: string().max(500).nullish() }`
- Valida semestre/materia/docente (**404**) y que estén activos (`400 INACTIVE_CATALOG_ITEM`).
- Duplicada (misma tupla completa) → **409** `OFFERING_ALREADY_EXISTS`. Misma materia+sección con **otro docente** es válida (comisión compartida).
- **201** `{ offering }` · **400** `VALIDATION_ERROR` | `INACTIVE_CATALOG_ITEM`

**`PATCH /api/course-offerings/:id`** — ENCARGADO (parcial)
- Body: `{ teacherId?, section?, type?, active?, note? }`
- Si cambia `section` o `teacherId`, revalida unicidad → **409** `OFFERING_ALREADY_EXISTS`.
- **200** `{ offering }` · **400** | **404** | **409**

**`DELETE /api/course-offerings/:id`** — ENCARGADO, baja lógica (`active=false`)
- Los bloques ya asignados se conservan; la comisión inactiva no acepta bloques nuevos.
- **200** `{ ok: true }` · **404** `NOT_FOUND`

#### Turnos

**`GET /api/time-slots`** — Autenticado
- **200** `{ timeSlots: TimeSlot[] }` (orden `order` asc; 9 registros por defecto) · **401**

#### Semestres

**`GET /api/semesters`** — Autenticado
- **200** `{ semesters: Semester[] }` (orden `startDate` desc) · **401**

**`POST /api/semesters`** — ENCARGADO
- Body: `{ name: string().min(2).max(20), startDate: coerce.date(), endDate: coerce.date() }` — `endDate` debe ser posterior a `startDate`.
- **201** `{ semester }` (con `isActive:false`) · **400** `VALIDATION_ERROR`

**`PATCH /api/semesters/:id`** — ENCARGADO (parcial)
- Body: `{ name?, startDate?, endDate? }`
- **200** `{ semester }` · **400** `VALIDATION_ERROR` · **404** `NOT_FOUND`

**`POST /api/semesters/:id/activate`** — ENCARGADO
- En una transacción: `updateMany({ isActive: false })` + `update(id, { isActive: true })`.
- **200** `{ semester }` (con `isActive:true`) · **404** `NOT_FOUND`

#### Schedules (bloques del grid)

**`GET /api/schedules?classroomId=&semesterId=`** — Autenticado
- Ambos query params **requeridos**; devuelve solo los del aula+semestre.
- Cada bloque incluye `timeSlot`, `classroom`, `courseOffering` (con `subject` y `teacher`) y `assignedBy` embebidos. Orden por `dayOfWeek` asc, luego `timeSlot.order` asc.
- **200** `{ schedules: Schedule[] }` · **400** `VALIDATION_ERROR` · **401**

**`POST /api/schedules`** — Autenticado (autor = usuario actual)
- Body: `{ classroomId, semesterId, courseOfferingId, dayOfWeek: int(1-6), timeSlotId, note?: string().max(500).nullish() }`
- Validaciones en orden, dentro de una transacción:
  1. Turno/aula/comisión existen → **404**.
  2. Existe semestre activo → si no, **409** `NO_ACTIVE_SEMESTER`.
  3. Aula `ACTIVA` sin mantenimiento abierto → **409** `CLASSROOM_UNAVAILABLE`.
  4. Comisión activa, con materia/docente activos, y `semesterId == offering.semesterId` → **400** `INACTIVE_CATALOG_ITEM` | `SEMESTER_MISMATCH`.
  5. Docente de la comisión libre ese día/turno → **409** `TEACHER_CONFLICT`.
  6. Celda libre (**409** `RESERVATION_CONFLICT`) y comisión no simultánea (**409** `OFFERING_CONFLICT`).
- **201** `{ schedule }` · **400** `VALIDATION_ERROR`

**`PATCH /api/schedules/:id`** — Autor del schedule o ENCARGADO
- Body parcial: `{ classroomId?, semesterId?, courseOfferingId?, dayOfWeek?, timeSlotId?, note? }`.
- Si cambia la celda o la comisión, re-ejecuta las validaciones 3–6 (con `NOT id` para excluirse a sí mismo de los conflictos).
- Ayudante no puede editar un schedule ajeno → **403**.
- **200** `{ schedule }` · **400** `VALIDATION_ERROR` · **403** `FORBIDDEN` · **404** `NOT_FOUND`

**`DELETE /api/schedules/:id`** — Autor o ENCARGADO
- Ayudante no puede eliminar un schedule ajeno → **403**.
- **200** `{ ok: true }` · **403** `FORBIDDEN` · **404** `NOT_FOUND`

#### Anotaciones

**`GET /api/annotations?classroomId=&from=&to=`** — Autenticado
- `classroomId` requerido; `from`/`to` opcionales (ISO). `to` es **inclusivo**: incluye todo el día de la fecha indicada. Orden `date` desc.
- **200** `{ annotations: Annotation[] }` · **400** `VALIDATION_ERROR` · **401**

**`POST /api/annotations`** — Autenticado
- Body: `{ classroomId, content: string().min(1).max(1000) }` (`userId` = usuario actual, `date = now()`).
- **201** `{ annotation }` · **400** `VALIDATION_ERROR` · **404** `NOT_FOUND`

**`DELETE /api/annotations/:id`** — Autor o ENCARGADO
- **200** `{ ok: true }` · **403** `FORBIDDEN` (ayudante sobre ajena) · **404** `NOT_FOUND`

#### Mantenimiento

**`GET /api/maintenance?classroomId=&status=`** — Autenticado
- Ambos opcionales (`status` ∈ `REPORTADO`/`EN_PROGRESO`/`COMPLETADO`). Orden `date` desc. Incluye `classroom` embebido.
- **200** `{ maintenance: MaintenanceLog[] }` · **400** `VALIDATION_ERROR` · **401**

**`POST /api/maintenance`** — Autenticado
- Body: `{ classroomId, date: coerce.date() (día calendario), reason: string().min(3).max(500) }`.
- Crea con `status: "REPORTADO"`. La fecha se normaliza a UTC medianoche.
- **En la misma transacción**, si el aula estaba `ACTIVA` pasa a `EN_MANTENIMIENTO`; a partir de ese momento rechaza reservas nuevas (`409 CLASSROOM_UNAVAILABLE`).
- **201** `{ maintenance }` · **400** `VALIDATION_ERROR` · **404** `NOT_FOUND`

**`PATCH /api/maintenance/:id`** — ENCARGADO
- Body: `{ status: enum("REPORTADO","EN_PROGRESO","COMPLETADO") }`.
- Si el nuevo estado deja al aula sin mantenimientos abiertos, el aula vuelve automáticamente a `ACTIVA`.
- **200** `{ maintenance }` · **400** `VALIDATION_ERROR` · **403** `FORBIDDEN` · **404** `NOT_FOUND`

**`DELETE /api/maintenance/:id`** — ENCARGADO
- Misma sincronización de estado que completar.
- **200** `{ ok: true }` · **403** `FORBIDDEN` · **404** `NOT_FOUND`

#### Estadísticas

**`GET /api/stats/overview`** — Autenticado
- **200** `StatsOverview`:
  - `totalClassrooms` y `classroomsByType` cuentan solo aulas con `status != "INACTIVA"` (incluye `EN_MANTENIMIENTO` y `FUERA_SERVICIO`).
  - `occupiedSlots` = schedules del semestre activo por aula (todo bloque cuenta; ya no existe el tipo `MANTENIMIENTO`).
  - `totalSlots` = **dinámico**: `count(timeSlot) × 6 días` (con el seed por defecto: 9 × 6 = 54).
  - `percentage` = redondeado a 2 decimales (0–100).
  - `pendingMaintenance` = `MaintenanceLog` con `status != "COMPLETADO"`.
  - Si no hay semestre activo, todos los `occupiedSlots`/`percentage` son 0.
- **401** si no autenticado.

#### Salud

**`GET /api/health`** — Público
- **200** `{ "status": "ok" }`

---

## Tests

Suite con **Vitest + Supertest** (`tests/`), ejecutable con `npm test`. **13 suites, 70 tests**. Cubre:

| Suite | Cobertura |
|-------|-----------|
| `auth.test.ts` | login correcto/inválido, validación de email, `/auth/me` con/sin token, token inválido |
| `users.test.ts` | CRUD usuarios, permisos ENCARGADO, `EMAIL_IN_USE`, `CANNOT_DELETE_SELF` |
| `subjects.test.ts` | CRUD materias, normalización de código, `SUBJECT_CODE_IN_USE`, reuso de código tras baja |
| `teachers.test.ts` | CRUD docentes, `TEACHER_CODE_IN_USE`, `TEACHER_EMAIL_IN_USE`, baja lógica |
| `course-offerings.test.ts` | CRUD comisiones, normalización de sección, duplicada (`OFFERING_ALREADY_EXISTS`), comisión compartida entre docentes, docente null |
| `classrooms.test.ts` | CRUD aulas, cambio de `status`, filtro por estado, soft delete → `INACTIVA` |
| `time-slots.test.ts` | listado de 9 turnos ordenados |
| `semesters.test.ts` | CRUD + activación única en transacción |
| `schedules.test.ts` | contrato nuevo (comisión), conflictos `RESERVATION_CONFLICT`, `TEACHER_CONFLICT`, `OFFERING_CONFLICT`, `SEMESTER_MISMATCH`, `NO_ACTIVE_SEMESTER`, permisos de autor/rol, embebido de comisión/docente/materia en respuesta |
| `annotations.test.ts` | CRUD y permisos de autor |
| `maintenance.test.ts` | creación por ayudante, estados solo encargado, sincronización aula `EN_MANTENIMIENTO` ↔ `ACTIVA`, bloqueo de reservas (`CLASSROOM_UNAVAILABLE`) |
| `stats.test.ts` | estructura de `StatsOverview` y ocupación |
| `rate-limit.test.ts` | `429 RATE_LIMIT_EXCEEDED` al superar el límite del login |

> Los tests usan la base real (`DATABASE_URL` del `.env`) y crean/limpian datos de prueba. Corren **secuenciales** (`fileParallelism: false`) porque comparten la BD; los hooks tienen timeout de 120s por la latencia de Neon. **No corras `npm test` contra la base de producción.**

---

## Datos maestros configurables (`prisma/seed.config.ts`)

El seed **no** inventa datos: importa todo desde `seed.config.ts`, que la institución edita **sin tocar lógica**.

| Export | Tipo | Contenido |
|--------|------|-----------|
| `TIME_SLOTS` | `TimeSlotSeed[]` | 9 turnos con `id`, `label`, `startTime`, `endTime`, `order` (1–9 únicos) |
| `CLASSROOMS` | `ClassroomSeed[]` | 8 aulas con `id`, `code` (único), `name`, `type`, `capacity?`, `location?` |
| `SEMESTER` | `SemesterSeed` | Semestre con `id`, `name`, `startDate`, `endDate` |
| `TEACHERS` | `TeacherSeed[]` | 30 docentes con `id`, `code` (único, slug del apellido), `name`, `email?`, `subjectCodes?` (referencia informativa) |
| `SUBJECTS` | `SubjectSeed[]` | 32 materias con `id`, `code` (único), `name`, `type?` (`CLASE`/`EXTRACURRICULAR`/`ACTIVIDAD`) |
| `BLOCKS` | `BlockSeed[]` | **110 bloques** de la grilla real: `{ classroomCode, dayOfWeek, timeSlotOrder, subjectCode, section, teacherCode? }` — la fuente de las comisiones y los horarios |
| `ADMIN` | `AdminSeed` | Usuario encargado con `id`, `name`, `email`, `password`, `role` |
| `AYUDANTES` | `AdminSeed[]` | Usuarios ayudantes iniciales |

Datos por defecto:

- **Turnos**: 9 períodos de `07:15` a `21:45`.
- **Aulas**: `D201`, `D302`, `D304`, `E112`, `D401`, `D402`, `D403`, `D404` (con tipo y capacidad).
- **Semestre**: `2026-A` (2026-08-01 → 2026-12-18), activo.
- **Docentes**: 30, códigos generados como slug del apellido (`SORIA`, `GUTIERREZ`, …). El docente genérico `INGLES` agrupa las cátedras de inglés; `EXCEL` y `AULA-COMUN` van sin docente.
- **Materias**: 29 regulares (`DD111`, `MO211`, …) + `INGLES`, `EXCEL` (extracurriculares, sección = grupo, ej. `10/4`) + `AULA-COMUN` (actividad).
- **Comisiones**: se **derivan** de `BLOCKS` (64 en total), no se declaran a mano.
- **Admin**: `admin@institucion.edu` / `admin123` (rol `ENCARGADO`) + 4 ayudantes.

Comportamiento:

- **Idempotente**: re-ejecutar `npm run prisma:seed` no duplica filas; hace `upsert` sobre catálogos, comisiones y bloques, y reactiva el semestre de configuración. Verifica conteos al final. **Nunca borra** datos operacionales que no estén en el config.
- Cambiar `name`/`code`/fechas/contraseñas → se aplica al re-ejecutar el seed.
- **Atención**: el seed sobrescribe la contraseña del admin en cada run.
- Los `id` del seed (`cls-d302`, `tea-soria`, `sub-dd111`, `off-*`, `usr-admin`, …) son estables: renombrarlos no migra referencias existentes.
- **Convención de comisiones compartidas**: cuando dos docentes dictan la misma materia+sección (ej. `DD311-A` con Soria y DeLaQuintana), se crean dos comisiones paralelas. Cuando un mismo grupo aparece simultáneo en dos aulas (caso Inglés `10/4` en D302/D304), el seed lo modela como secciones `10/4` y `10/4-B`.

---

## Notas de implementación (comportamiento real)

Particularidades de la implementación actual, documentadas para que el README sea una guía fiel:

1. **`NO_ACTIVE_SEMESTER`** se lanza en `POST /schedules` solo cuando **no existe ningún** semestre activo. Se permite crear un schedule en un semestre **inactivo** si hay al menos un semestre activo (planificación futura). En `PATCH /schedules`, el chequeo solo corre si cambia la celda manteniendo el semestre.
2. **Transacciones con `timeout: 30s / maxWait: 10s`** (`TX_OPTIONS`): las validaciones anti-conflicto corren en transacciones interactivas de Prisma que hacen ~6 roundtrips a Neon; el default de 5s producía `P2028` intermitente (HTTP 500). Aplica a los servicios de schedules y mantenimiento.
3. **Normalización de códigos**: `Subject.code`, `Teacher.code`, `Classroom.code` y `CourseOffering.section` se guardan **en mayúsculas** (`transform` Zod + servicio); emails de docentes se lowercasean. La unicidad es insensible a mayúsculas en la práctica porque siempre se normaliza antes de escribir.
4. **Conflictos por P2002**: el mapeo usa `meta.target` (`utils/dbErrors.ts`) para distinguir `OFFERING_CONFLICT` (comisión simultánea) de `RESERVATION_CONFLICT` (celda). Los conflictos de docente se detectan **antes** del INSERT (query dentro de la transacción), no por constraint.
5. **Sincronización aula ↔ mantenimiento** (`syncClassroomAvailability`): idempotente y conservadora — solo alterna entre `ACTIVA` y `EN_MANTENIMIENTO`; nunca toca `INACTIVA` ni `FUERA_SERVICIO`.
6. **Zod 4**: se usa la sintaxis nueva `z.email()` (en lugar de `z.string().email()` de Zod 3).
7. **Seed**: el `upsert` del admin re-hashea la contraseña en cada ejecución (ver sección de seed).
8. **`.env` actual** usa una URL **pooled** de Neon con `channel_binding=require`, aunque `PLAN.md` recomienda la conexión **directa** para Prisma. Verifica cuál te da mejor resultado con `npx prisma migrate dev`.
9. **Borrado de ruta no encontrada**: `notFoundHandler` devuelve `404 NOT_FOUND` con mensaje "Ruta no encontrada".
10. **Login anti-enumeración**: cuando el email no existe se ejecuta igualmente `bcrypt.compare` contra un hash dummy.
11. **JWT**: el token solo lleva `sub`; el rol se lee siempre de BD, así un cambio de rol no queda congelado en tokens emitidos.
12. **Vitest**: `hookTimeout: 120000` global (los `beforeAll` crean catálogos completos contra la API remota).

---

## Resumen de la migración del modelo de datos (2026-08)

Implementación completa de [`PLAN_MIGRACION_MODELO_DATOS.md`](../PLAN_MIGRACION_MODELO_DATOS.md) sobre [`NORMALIZACION_MODELO_DATOS.md`](../NORMALIZACION_MODELO_DATOS.md). Corte directo sin ventana de compatibilidad.

### Antes → Después

| Concepto | Antes | Después |
|----------|-------|---------|
| Bloque de horario | Texto libre (`type` CLASE/ACTIVIDAD/MANTENIMIENTO, `title`, `teacher`) | Referencia a comisión (`courseOfferingId`) + `note` |
| Qué se dicta | Implícito en el título | `Subject {code, name}` en catálogo |
| Quién lo dicta | String libre por celda | `Teacher {code, name, email}` en catálogo |
| Comisión | No existía | `CourseOffering (semestre, materia, sección, docente?)` |
| Estado de aula | Boolean `active` | Enum `status`: `ACTIVA` · `INACTIVA` · `EN_MANTENIMIENTO` · `FUERA_SERVICIO` |
| Mantenimiento | Schedule con `type=MANTENIMIENTO` | Proceso propio (`MaintenanceLog`) que sincroniza el estado del aula |
| Conflictos validados | Celda ocupada | Celda + comisión simultánea + docente simultáneo + semestre/comisión + disponibilidad de aula |
| Semestre activo único | Por convención (transacción) | Garantizado por índice parcial único en BD |

### Migraciones aplicadas

1. `20260814232520_init` · 2. `20260814233431_capacity_optional` (previas)
3. `20260821192348_normalize_data_model` — nuevos modelos/catálogos, enums, constraints e índice parcial de semestre activo (SQL manual)
4. `20260821193600_offering_teacher_unique` — unicidad de comisión incluye `teacherId` para permitir comisiones compartidas entre docentes

### Anomalías reales de los datos resueltas

- **Comisiones con dos docentes** (DD311-A, DD111-B/C, IT110-A, MO311-A): modeladas como comisiones paralelas gracias a la clave única de 4 columnas.
- **Inglés (10/4) simultáneo en D302 y D304** (lunes 4° período): grupos paralelos reales → secciones `10/4` (D302) y `10/4-B` (D304). Si la institución usa otra convención, se corrige vía API.

### Checklist de cambios breaking para el frontend (`labmanage-web`)

- [ ] Reemplazar `schedule.type/title/teacher` por `schedule.courseOffering {subject, teacher, section, type}` en grid y formularios.
- [ ] Formulario de bloques: selects encadenados materia → comisión (`GET /course-offerings?semesterId=`) en lugar de texto libre.
- [ ] Eliminar la opción `MANTENIMIENTO` del formulario de horarios; usar la vista de mantenimiento existente.
- [ ] `classroom.active` → `classroom.status` (badges/filtros); nuevo filtro `?status=` en `GET /classrooms`.
- [ ] Nuevas pantallas o pestañas de catálogo: materias, docentes y comisiones (CRUD ENCARGADO).
- [ ] Actualizar `web/src/lib/types.ts` con los tipos de la sección [Tipos de respuesta](#tipos-de-respuesta).
- [ ] Manejar los nuevos códigos de error (`TEACHER_CONFLICT`, `OFFERING_CONFLICT`, `CLASSROOM_UNAVAILABLE`, `SEMESTER_MISMATCH`, `INACTIVE_CATALOG_ITEM`).

---

## Despliegue (referencia)

- **BD**: Neon (producción).
- **API**: Railway o Render — Node 20, `npm install && npx prisma migrate deploy && npm run build && npm start`.
- **Web**: Vercel/Netlify — build estático de Astro con `PUBLIC_API_URL` apuntando a la API desplegada.