# LABMANAGE API

Backend REST de **LABMANAGE**, sistema de gestión de aulas/laboratorios: disponibilidad, uso y estados de las aulas de una institución.

Este proyecto es la **API** que administra la base de datos. El frontend (`labmanage-web`, Astro + React) **solo** consume esta API a través de HTTP/JSON con autenticación JWT.

> **Fuente de verdad**: el contrato completo de la API y las reglas de negocio viven en [`PLAN.md`](../PLAN.md) (secciones 5–8). Este README documenta el **comportamiento real** de la implementación actual y sirve de guía para instalar, usar y extender el proyecto.

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
│   └── utils/               # errors.ts (ApiError) · serializers.ts (toPublicUser)
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

Esquema completo en `prisma/schema.prisma`. Seis modelos:

| Modelo | Descripción | Campos clave | Relaciones |
|--------|-------------|--------------|------------|
| `User` | Usuario del sistema (encargado/ayudante) | `email` (único), `passwordHash`, `role`, `active` | `schedules`, `annotations`, `maintenance` |
| `Classroom` | Aula/laboratorio | `code` (único), `name`, `type`, `capacity?`, `location?`, `active` | `schedules`, `annotations`, `maintenance` |
| `TimeSlot` | Turno horario fijo | `label`, `startTime`, `endTime`, `order` (único) | `schedules` |
| `Semester` | Semestre académico | `name`, `startDate`, `endDate`, `isActive` | `schedules` |
| `Schedule` | Bloque del grid (reserva) | `dayOfWeek`, `type`, `title`, `teacher?`, `note?` | `classroom`, `semester`, `timeSlot`, `assignedBy` |
| `Annotation` | Anotación/bitácora de un aula | `date`, `content` | `classroom`, `user` |
| `MaintenanceLog` | Reporte de mantenimiento | `date`, `reason`, `status` | `classroom`, `createdBy` |

### Enums

| Enum | Valores |
|------|---------|
| `UserRole` | `ENCARGADO` · `AYUDANTE` |
| `ClassroomType` | `LAB_COMPUTACION` · `LAB_GENERAL` · `AULA` |
| `ScheduleType` | `CLASE` · `ACTIVIDAD` · `MANTENIMIENTO` |
| `MaintenanceStatus` | `REPORTADO` · `EN_PROGRESO` · `COMPLETADO` |

### Regla de unicidad clave

**Una celda = un bloque**: `@@unique([classroomId, semesterId, dayOfWeek, timeSlotId])`. No puede existir una clase/actividad y un mantenimiento en la misma celda del grid. La violación se captura como `P2002` y se traduce a `409 RESERVATION_CONFLICT`.

---

## Reglas de negocio

1. **Una celda = un bloque** — constraint `@@unique` sobre `(classroomId, semesterId, dayOfWeek, timeSlotId)`.
2. **Estado de celda (derivado, no persistido)**:
   - `MANTENIMIENTO` → existe un `Schedule` con `type=MANTENIMIENTO`.
   - `OCUPADA` → existe un `Schedule` `CLASE` o `ACTIVIDAD`.
   - `LIBRE` → sin bloque.
3. **Un solo semestre activo** a la vez — `activateSemester` usa una transacción: desactiva todos (`updateMany`) y activa el elegido.
4. **Permisos**:
   - `ENCARGADO`: todo (usuarios, aulas, semestres, mantenimiento, cualquier schedule/anotación).
   - `AYUDANTE`: ver todo; crear/editar/eliminar **sus propios** schedules `CLASE`/`ACTIVIDAD`; crear y eliminar **sus propias** anotaciones; crear reportes de mantenimiento (no puede cambiar su estado).
   - Schedules `type=MANTENIMIENTO`: **solo `ENCARGADO`** los crea/edita/elimina. Un ayudante que intente enviar `type=MANTENIMIENTO` recibe `403 FORBIDDEN`.
5. **Contraseñas**: `bcryptjs` con salt 12; `passwordHash` nunca se expone en respuestas.
6. **JWT**: expiración 12h; `requireAuth` adjunta `req.user`; `requireRole('ENCARGADO')` protege rutas administrativas.
7. **Borrado lógico** de aulas y usuarios (`active=false`); borrado físico de schedules, anotaciones y mantenimiento.
8. **Validación Zod** en todos los `body`/`query`/`params`; error `400 VALIDATION_ERROR` con `details` estructurados.
9. **Errores**: formato uniforme `{ "error": { "code", "message", "details? } }` (catálogo en la sección de errores).
10. **Fecha de mantenimiento**: `date` se interpreta como día calendario (se normaliza a UTC medianoche); formato `YYYY-MM-DD` o ISO.

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
| **AUTENTICADO** (encargado o ayudante) | `GET /api/auth/me` · `GET /api/classrooms` · `GET /api/time-slots` · `GET /api/semesters` · `GET /api/schedules` · `GET /api/annotations` · `GET /api/maintenance` · `GET /api/stats/overview` · `POST /api/schedules`* · `PATCH /api/schedules/:id`** · `DELETE /api/schedules/:id`** · `POST /api/annotations` · `DELETE /api/annotations/:id`** · `POST /api/maintenance` |
| **ENCARGADO** (solo) | `GET/POST/PATCH/DELETE /api/users` · `POST/PATCH/DELETE /api/classrooms` · `POST/PATCH /api/semesters` · `POST /api/semesters/:id/activate` · `PATCH/DELETE /api/maintenance/:id` |
| **AUTOR del recurso o ENCARGADO** | `PATCH/DELETE /api/schedules/:id` · `DELETE /api/annotations/:id` |

\* `POST /api/schedules` con `type=MANTENIMIENTO` exige rol `ENCARGADO`; un ayudante recibe `403`.
\*\* Un ayudante solo puede editar/eliminar schedules **propios** que no sean `MANTENIMIENTO`.

> **Rate limiting**: `POST /api/auth/login` está limitado a **20 intentos por IP cada 15 minutos** (configurable vía `createLoginLimiter` en `src/middleware/rateLimit.ts`). Al superarse responde `429 RATE_LIMIT_EXCEEDED`. Durante los tests (`NODE_ENV=test`) el límite se eleva para no interferir con la suite.

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
- **Enums** viajan como strings exactas: `"ENCARGADO"`, `"AYUDANTE"`, `"LAB_COMPUTACION"`, `"LAB_GENERAL"`, `"AULA"`, `"CLASE"`, `"ACTIVIDAD"`, `"MANTENIMIENTO"`, `"REPORTADO"`, `"EN_PROGRESO"`, `"COMPLETADO"`.

### Catálogo de códigos de error

| Código | HTTP | Cuándo |
|--------|------|--------|
| `VALIDATION_ERROR` | 400 | Body/query/params no cumplen Zod; `details` con issues por campo |
| `CANNOT_DELETE_SELF` | 400 | Encargado intenta eliminarse a sí mismo |
| `AUTH_INVALID_CREDENTIALS` | 401 | Login con email o contraseña incorrecta |
| `TOKEN_INVALID` | 401 | Token ausente, malformado, de firma inválida, o usuario no encontrado/desactivado |
| `TOKEN_EXPIRED` | 401 | Token vencido (>12h) |
| `USER_INACTIVE` | 401 | Usuario desactivado (`active=false`) intenta autenticarse |
| `FORBIDDEN` | 403 | Rol no permitido o no es el autor del recurso |
| `NOT_FOUND` | 404 | Recurso inexistente, ruta inexistente o referencia inexistente (P2003) |
| `RESERVATION_CONFLICT` | 409 | Celda ya ocupada (violación del `@@unique`, `P2002`) |
| `EMAIL_IN_USE` | 409 | Email duplicado en usuarios (`P2002`) |
| `CLASSROOM_CODE_IN_USE` | 409 | Código de aula duplicado (`P2002`) |
| `CONFLICT` | 409 | Otra violación de unicidad `P2002` no clasificada |
| `NO_ACTIVE_SEMESTER` | 409 | `POST /schedules` cuando **no existe ningún** semestre activo |
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
type ScheduleType = "CLASE" | "ACTIVIDAD" | "MANTENIMIENTO";
type MaintenanceStatus = "REPORTADO" | "EN_PROGRESO" | "COMPLETADO";

interface User { id: string; name: string; email: string; role: UserRole; active: boolean; createdAt: string; updatedAt: string; }        // NUNCA incluye passwordHash
interface Classroom { id: string; code: string; name: string; type: ClassroomType; capacity: number | null; location: string | null; active: boolean; createdAt: string; updatedAt: string; }
interface TimeSlot { id: string; label: string; startTime: string; endTime: string; order: number; }
interface Semester { id: string; name: string; startDate: string; endDate: string; isActive: boolean; }
interface Schedule {
  id: string; classroomId: string; semesterId: string; dayOfWeek: number; timeSlotId: string;
  timeSlot: TimeSlot; type: ScheduleType; title: string; teacher: string | null; note: string | null;
  assignedById: string; assignedBy: { id: string; name: string }; updatedAt: string;
}
interface Annotation { id: string; classroomId: string; userId: string; user: { id: string; name: string }; date: string; content: string; }
interface MaintenanceLog { id: string; classroomId: string; classroom: { id: string; code: string; name: string }; date: string; reason: string; status: MaintenanceStatus; createdById: string; createdAt: string; }
interface StatsOverview {
  totalClassrooms: number;
  classroomsByType: { type: ClassroomType; count: number }[];
  activeSemester: { id: string; name: string } | null;
  occupancyByClassroom: { classroom: { id: string; code: string; name: string }; occupiedSlots: number; totalSlots: number; percentage: number }[];
  pendingMaintenance: number;
}
interface AuthResponse { token: string; user: User; }
```

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
- Query opcional: `?includeInactive=true` (solo ENCARGADO ve inactivos).
- **200** `{ classrooms: Classroom[] }` (orden `code` asc) · **401**

**`POST /api/classrooms`** — ENCARGADO
- Body: `{ code: string().min(2).max(20) → uppercase+trim, name: string().min(2).max(100), type: enum(...), capacity?: int().min(1).max(500), location?: string().max(200).nullish() }`
- **201** `{ classroom }` · **400** `VALIDATION_ERROR` · **409** `CLASSROOM_CODE_IN_USE`

**`PATCH /api/classrooms/:id`** — ENCARGADO (parcial)
- Body: `{ code?, name?, type?, capacity?, location? }`
- **200** `{ classroom }` · **400** `VALIDATION_ERROR` · **404** `NOT_FOUND` · **409** `CLASSROOM_CODE_IN_USE`

**`DELETE /api/classrooms/:id`** — ENCARGADO, soft delete
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
- Incluye `timeSlot` y `assignedBy` embebidos. Orden por `dayOfWeek` asc, luego `timeSlot.order` asc.
- **200** `{ schedules: Schedule[] }` · **400** `VALIDATION_ERROR` · **401**

**`POST /api/schedules`** — Autenticado (autor = usuario actual)
- Body: `{ classroomId, semesterId, dayOfWeek: int(1-6), timeSlotId, type: enum("CLASE","ACTIVIDAD","MANTENIMIENTO"), title: string().min(1).max(120), teacher?: string().max(100).nullish(), note?: string().max(500).nullish() }`
- Valida que `classroom`, `semester` y `timeSlot` existan → **404** `NOT_FOUND`.
- `type=MANTENIMIENTO` con rol `AYUDANTE` → **403** `FORBIDDEN`.
- Conflicto de celda (constraint `@@unique` / `P2002`) → **409** `RESERVATION_CONFLICT`.
- Sin semestre activo → **409** `NO_ACTIVE_SEMESTER`.
- **201** `{ schedule }` · **400** `VALIDATION_ERROR`

**`PATCH /api/schedules/:id`** — Autor del schedule o ENCARGADO
- Body parcial: `{ classroomId?, semesterId?, dayOfWeek?, timeSlotId?, type?, title?, teacher?, note? }`.
- Si cambia la celda (`classroomId`/`semesterId`/`dayOfWeek`/`timeSlotId`), valida que aula/semestre/turno existan (**404**) y revalida conflicto → **409** `RESERVATION_CONFLICT`.
- Ayudante **no** puede: editar schedule ajeno (**403**), editar un `MANTENIMIENTO` (**403**) ni cambiarlo a `type=MANTENIMIENTO` (**403**).
- **200** `{ schedule }` · **400** `VALIDATION_ERROR` · **404** `NOT_FOUND`

**`DELETE /api/schedules/:id`** — Autor o ENCARGADO
- **200** `{ ok: true }` · **403** `FORBIDDEN` (ayudante sobre ajeno o `MANTENIMIENTO`) · **404** `NOT_FOUND`

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
- **201** `{ maintenance }` · **400** `VALIDATION_ERROR` · **404** `NOT_FOUND`

**`PATCH /api/maintenance/:id`** — ENCARGADO
- Body: `{ status: enum("REPORTADO","EN_PROGRESO","COMPLETADO") }`.
- **200** `{ maintenance }` · **400** `VALIDATION_ERROR` · **403** `FORBIDDEN` · **404** `NOT_FOUND`

**`DELETE /api/maintenance/:id`** — ENCARGADO
- **200** `{ ok: true }` · **403** `FORBIDDEN` · **404** `NOT_FOUND`

#### Estadísticas

**`GET /api/stats/overview`** — Autenticado
- **200** `StatsOverview`:
  - `occupiedSlots` = schedules `CLASE`/`ACTIVIDAD` en el semestre activo (el `MANTENIMIENTO` no cuenta).
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

Suite con **Vitest + Supertest** (`tests/`), ejecutable con `npm test`. Cubre:

| Suite | Cobertura |
|-------|-----------|
| `auth.test.ts` | login correcto/inválido, validación de email, `/auth/me` con/sin token, token inválido |
| `users.test.ts` | CRUD usuarios, permisos ENCARGADO, `EMAIL_IN_USE`, `CANNOT_DELETE_SELF` |
| `classrooms.test.ts` | CRUD aulas, `CLASSROOM_CODE_IN_USE`, `includeInactive` |
| `time-slots.test.ts` | listado de 9 turnos ordenados |
| `semesters.test.ts` | CRUD + activación única en transacción |
| `schedules.test.ts` | conflicto de celda (409), permisos de autor y rol, `MANTENIMIENTO` solo encargado, `NO_ACTIVE_SEMESTER`, reservas en semestre inactivo con activo |
| `annotations.test.ts` | CRUD y permisos de autor |
| `maintenance.test.ts` | creación por ayudante, cambio de estado/borrado solo encargado |
| `stats.test.ts` | estructura de `StatsOverview` y ocupación |
| `rate-limit.test.ts` | `429 RATE_LIMIT_EXCEEDED` al superar el límite del login |

> Los tests usan la base real (`DATABASE_URL` del `.env`) y crean/limpian datos de prueba (aulas, semestres, schedules, usuarios helper con `cleanupTestUsers`). **No corras `npm test` contra la base de producción.**

---

## Datos maestros configurables (`prisma/seed.config.ts`)

El seed **no** inventa datos: importa todo desde `seed.config.ts`, que la institución edita **sin tocar lógica**.

| Export | Tipo | Contenido |
|--------|------|-----------|
| `TIME_SLOTS` | `TimeSlotSeed[]` | 9 turnos con `id`, `label`, `startTime`, `endTime`, `order` (1–9 únicos) |
| `CLASSROOMS` | `ClassroomSeed[]` | Aulas con `id`, `code` (único), `name`, `type`, `capacity?`, `location?` |
| `SEMESTER` | `SemesterSeed` | Semestre con `id`, `name`, `startDate`, `endDate` |
| `ADMIN` | `AdminSeed` | Usuario con `id`, `name`, `email` (único), `password`, `role` |

Datos por defecto:

- **Turnos**: 9 períodos de `07:15` a `21:45`.
- **Aulas**: `LAB-01` y `LAB-02` (Laboratorio de computación), `AULA-01` (Aula).
- **Semestre**: `2026-A` (2026-08-01 → 2026-12-18), activo.
- **Admin**: `admin@institucion.edu` / `admin123` (rol `ENCARGADO`).

Comportamiento:

- **Idempotente**: re-ejecutar `npm run prisma:seed` no duplica filas; hace `upsert` sobre los datos maestros y reactiva el semestre de configuración. **Nunca borra** datos operacionales (schedules, anotaciones, mantenimiento).
- Cambiar `name`/`code`/`type`/fechas/`password` → se aplica al re-ejecutar el seed.
- **Atención**: el seed **sobrescribe la contraseña del admin en cada run** (re-genera el hash). Si el admin cambió su contraseña desde la UI, el seed la revierte a `ADMIN.password`.
- Los `id` del seed (`cls-lab-1`, `ts-1`, `sem-2026-a`, `usr-admin`) se consideran **estables**: renombrarlos no migra las referencias existentes. Una vez con datos operacionales, usar el CRUD de la API para renombrar, no el config.

---

## Notas de implementación (comportamiento real)

Particularidades de la implementación actual, documentadas para que el README sea una guía fiel:

1. **`NO_ACTIVE_SEMESTER`** se lanza en `POST /schedules` solo cuando **no existe ningún** semestre activo. Se permite crear un schedule en un semestre **inactivo** si hay al menos un semestre activo (verificado por test). En `PATCH /schedules`, el chequeo solo corre si se cambia el `semesterId`.
2. **Zod 4**: se usa la sintaxis nueva `z.email()` (en lugar de `z.string().email()` de Zod 3).
3. **Seed**: el `upsert` del admin re-hashea la contraseña en cada ejecución (ver sección de seed).
4. **`.env` actual** usa una URL **pooled** de Neon con `channel_binding=require`, aunque `PLAN.md` recomienda la conexión **directa** para Prisma. Verifica cuál te da mejor resultado con `npx prisma migrate dev`.
5. **Borrado de ruta no encontrada**: `notFoundHandler` devuelve `404 NOT_FOUND` con mensaje "Ruta no encontrada" (mismo código que recurso inexistente).
6. **Login anti-enumeración**: cuando el email no existe se ejecuta igualmente `bcrypt.compare` contra un hash dummy, para que el tiempo de respuesta no revele si un email está registrado.
7. **JWT**: el token solo lleva `sub` (id del usuario); el rol se lee siempre de la base de datos, así un cambio de rol no queda "congelado" en tokens ya emitidos.

---

## Despliegue (referencia)

- **BD**: Neon (producción).
- **API**: Railway o Render — Node 20, `npm install && npx prisma migrate deploy && npm run build && npm start`.
- **Web**: Vercel/Netlify — build estático de Astro con `PUBLIC_API_URL` apuntando a la API desplegada.