# LABMANAGE API — Plan de migración y normalización del modelo de datos

## 1. Propósito

Este documento define el plan técnico para modificar la estructura de datos de `labmanage-api` y lograr que aulas, semestres, turnos, materias, comisiones, docentes, usuarios, horarios y mantenimientos se almacenen sin ambigüedades.

El plan está basado en el modelo actual de Prisma, los servicios existentes y el documento `NORMALIZACION_MODELO_DATOS.md`.

> Este documento es una propuesta de implementación. No modifica código, esquema Prisma, migraciones ni datos. La implementación comenzará únicamente después de su confirmación.

## 2. Objetivos

La implementación deberá garantizar que:

- Cada materia tenga un código único y un registro de catálogo.
- Cada docente tenga un código institucional único y un registro propio.
- Una materia pueda tener distintas comisiones según el semestre.
- Una comisión pueda tener un docente asignado durante un semestre concreto.
- Cada bloque horario referencie relaciones, nunca nombres o códigos escritos libremente.
- Solo existan los nueve turnos oficiales.
- Una celda de aula, semestre, día y turno tenga como máximo un bloque ocupado.
- Un docente no pueda estar asignado a dos aulas en el mismo día y turno.
- Las aulas tengan estados explícitos y coherentes.
- Un aula en mantenimiento o fuera de servicio no pueda recibir nuevas reservas.
- Las clases regulares, extracurriculares y actividades puedan distinguirse correctamente.
- El seed sea reproducible, idempotente y represente los datos normalizados.
- La API y el frontend utilicen contratos consistentes.

## 3. Problemas del modelo actual

El modelo vigente permite varias formas de ambigüedad:

1. `Schedule.title` almacena indistintamente códigos de materias, nombres de actividades y etiquetas especiales.
2. `Schedule.teacher` almacena nombres libres, sin catálogo ni integridad referencial.
3. No existen modelos `Teacher` ni `Subject`.
4. No existe una entidad para representar una materia dictada en un semestre, con comisión y docente.
5. `ScheduleType` no incluye `EXTRACURRICULAR`.
6. `Classroom.active` no permite diferenciar aula inactiva, en mantenimiento o fuera de servicio.
7. `MANTENIMIENTO` está mezclado con los bloques de horario, aunque el mantenimiento operativo se almacena también en `MaintenanceLog`.
8. La existencia de un `MaintenanceLog` abierto no bloquea nuevas reservas.
9. El catálogo de `TimeSlot` puede ser modificado sin garantizar que conserve los nueve períodos oficiales.
10. No se valida que un docente no esté simultáneamente en dos aulas.
11. El seed no representa completamente las ocho aulas ni todos los tipos definidos en la documentación normalizada.
12. El estado `isActive` de los semestres no posee una restricción de base de datos que garantice un único semestre activo.

## 4. Modelo de datos objetivo

La relación principal será:

```text
Semester
  |
  +-- CourseOffering
        |
        +-- Subject
        +-- Teacher
        +-- Schedule
              |
              +-- Classroom
              +-- TimeSlot
              +-- User assignedBy
```

### 4.1 Diferencia entre materia, comisión y bloque

Estas entidades no deben mezclarse:

- **Subject**: materia del catálogo institucional. Ejemplo: `DD311`.
- **CourseOffering**: instancia de la materia que se dicta en un semestre y comisión concretos. Ejemplo: `DD311-A` en `2026-A`, con docente Soria.
- **Schedule**: ubicación temporal y física de esa comisión. Ejemplo: lunes, período 1, aula D302.

Esta separación evita almacenar en `Schedule` información que pertenece al catálogo o a la planificación académica.

## 5. Cambios propuestos en Prisma

### 5.1 Nuevos enums

Agregar:

```prisma
enum ClassroomStatus {
  ACTIVA
  INACTIVA
  EN_MANTENIMIENTO
  FUERA_SERVICIO
}

enum CourseOfferingType {
  CLASE
  EXTRACURRICULAR
  ACTIVIDAD
}
```

`MANTENIMIENTO` no se utilizará como tipo de clase. El mantenimiento se representará con `MaintenanceLog` y, si se requiere bloquear franjas específicas, con un modelo separado de bloqueo.

### 5.2 Modelo `Teacher`

```prisma
model Teacher {
  id             String           @id @default(cuid())
  code           String           @unique
  name           String
  email          String?          @unique
  active         Boolean          @default(true)
  offerings      CourseOffering[]
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}
```

Reglas:

- `code` es obligatorio y único.
- El nombre se almacena una sola vez.
- La baja será lógica mediante `active`.
- Un docente inactivo no podrá ser asignado a nuevas comisiones.
- El borrado físico estará restringido si existen relaciones históricas.

### 5.3 Modelo `Subject`

```prisma
model Subject {
  id             String           @id @default(cuid())
  code           String           @unique
  name           String
  active         Boolean          @default(true)
  offerings      CourseOffering[]
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}
```

Reglas:

- `code` identifica la materia del catálogo.
- El código no se repetirá entre materias.
- La baja será lógica.
- No se utilizarán códigos de materias como texto libre dentro de `Schedule`.

### 5.4 Modelo `CourseOffering`

```prisma
model CourseOffering {
  id          String             @id @default(cuid())
  semesterId  String
  subjectId   String
  teacherId   String?
  section     String
  type        CourseOfferingType @default(CLASE)
  active      Boolean            @default(true)
  note        String?
  semester    Semester           @relation(fields: [semesterId], references: [id], onDelete: Cascade)
  subject     Subject            @relation(fields: [subjectId], references: [id])
  teacher     Teacher?           @relation(fields: [teacherId], references: [id])
  schedules   Schedule[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@unique([semesterId, subjectId, section])
  @@index([semesterId])
  @@index([subjectId])
  @@index([teacherId])
}
```

Reglas:

- Una comisión pertenece exactamente a un semestre y una materia.
- El docente puede ser opcional para casos como Excel.
- `section` permite representar `A`, `B`, `Z1`, `10/4`, `5/5` u otra comisión institucional.
- `type` distingue `CLASE`, `EXTRACURRICULAR` y `ACTIVIDAD`.
- La identificación visible puede construirse como `subject.code + section`, sin duplicarla como fuente independiente.

### 5.5 Cambios en `Classroom`

Reemplazar:

```prisma
active Boolean @default(true)
```

por:

```prisma
status ClassroomStatus @default(ACTIVA)
```

El modelo conservará:

- `code` único.
- `name`.
- `type`.
- `capacity` opcional.
- `location` opcional.
- relaciones con horarios, anotaciones y mantenimientos.

No se mantendrán simultáneamente `active` y `status`, porque representarían dos fuentes de verdad para disponibilidad.

### 5.6 Cambios en `Schedule`

El modelo objetivo será conceptualmente:

```prisma
model Schedule {
  id               String         @id @default(cuid())
  classroomId      String
  semesterId       String
  courseOfferingId String
  dayOfWeek        Int
  timeSlotId       String
  note             String?
  assignedById     String
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  classroom      Classroom      @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  semester       Semester       @relation(fields: [semesterId], references: [id], onDelete: Cascade)
  courseOffering CourseOffering @relation(fields: [courseOfferingId], references: [id], onDelete: Cascade)
  timeSlot       TimeSlot       @relation(fields: [timeSlotId], references: [id])
  assignedBy     User           @relation(fields: [assignedById], references: [id])

  @@unique([classroomId, semesterId, dayOfWeek, timeSlotId])
  @@index([classroomId, semesterId])
  @@index([courseOfferingId])
}
```

Eliminar progresivamente:

- `title`.
- `teacher`.
- `type`.

El tipo se obtendrá desde `CourseOffering.type`.

### 5.7 Semestres

Mantener `Semester`, pero agregar reglas:

- `name` debe ser único, por ejemplo `2026-A`.
- `endDate` debe ser posterior a `startDate`.
- Solo un semestre puede estar activo.
- La activación debe realizarse en una transacción.
- La base de datos debe incluir una restricción parcial para impedir dos activos, si PostgreSQL y Prisma lo permiten mediante migración SQL manual.

### 5.8 Turnos oficiales

`TimeSlot` se mantendrá como catálogo maestro con exactamente estos períodos:

| Orden | Inicio | Fin |
|---:|---|---|
| 1 | 07:15 | 08:45 |
| 2 | 08:55 | 10:25 |
| 3 | 10:30 | 12:00 |
| 4 | 12:20 | 13:50 |
| 5 | 13:55 | 15:25 |
| 6 | 15:30 | 17:00 |
| 7 | 17:05 | 18:35 |
| 8 | 18:40 | 20:10 |
| 9 | 20:15 | 21:45 |

Reglas:

- `order` único entre 1 y 9.
- No se aceptarán turnos creados libremente por endpoints generales.
- `startTime` y `endTime` se validarán con formato `HH:mm`.
- Los cambios al catálogo requerirán una migración controlada.

## 6. Mantenimiento y disponibilidad

### 6.1 Mantenimiento operativo

`MaintenanceLog` seguirá registrando incidencias y trabajos:

- `REPORTADO`.
- `EN_PROGRESO`.
- `COMPLETADO`.

La creación de un registro en estado `REPORTADO` o `EN_PROGRESO` deberá bloquear nuevas reservas del aula.

### 6.2 Regla de bloqueo

Una reserva solo podrá crearse o moverse a un aula cuyo estado sea `ACTIVA` y que no tenga un `MaintenanceLog` abierto.

Estados bloqueantes:

- `INACTIVA`.
- `EN_MANTENIMIENTO`.
- `FUERA_SERVICIO`.

### 6.3 Mantenimiento por franja horaria

Si el negocio necesita bloquear solo algunos días o períodos, se agregará `MaintenanceBlock`:

```text
MaintenanceBlock
  id
  classroomId
  semesterId opcional
  dayOfWeek
  timeSlotId
  maintenanceLogId
```

Su restricción será:

```text
@@unique([classroomId, semesterId, dayOfWeek, timeSlotId])
```

No se mezclará este bloqueo con una clase dentro de `Schedule`.

## 7. Reglas de integridad

### 7.1 Integridad de relaciones

- Todo `Schedule` debe tener `Classroom`, `Semester`, `CourseOffering`, `TimeSlot` y `assignedBy` válidos.
- El `CourseOffering.semesterId` debe coincidir con `Schedule.semesterId`.
- El `Subject` y el `Teacher` relacionados deben existir.
- Los registros inactivos no podrán utilizarse para nuevas asignaciones.

La coincidencia entre `Schedule.semesterId` y `CourseOffering.semesterId` deberá validarse en el servicio o mediante un diseño que evite la duplicación. La FK por sí sola no garantiza esa coincidencia.

### 7.2 Celda única

Se conservará:

```text
classroomId + semesterId + dayOfWeek + timeSlotId
```

Esto garantiza una sola ocupación por aula, semestre, día y turno.

### 7.3 Conflicto de docente

Agregar una validación de negocio para impedir que el mismo docente tenga dos horarios simultáneos:

```text
teacherId + semesterId + dayOfWeek + timeSlotId
```

Este conflicto no se puede resolver directamente con un índice único sobre `Schedule` porque el docente está indirectamente relacionado mediante `CourseOffering`; se validará dentro de una transacción.

### 7.4 Comisiones

Una misma comisión no debería tener dos bloques simultáneos. Se validará:

```text
courseOfferingId + dayOfWeek + timeSlotId
```

Esto debe impedir que una comisión esté en dos aulas a la misma hora.

### 7.5 Días y fechas

- `dayOfWeek`: entero entre 1 y 6.
- `1`: lunes.
- `6`: sábado.
- Las fechas de mantenimiento se almacenarán como fecha calendario normalizada.

## 8. Migración de datos existente

La migración se ejecutará en pasos para evitar pérdida de información.

### Paso 1: ampliar el esquema

Crear:

- `Teacher`.
- `Subject`.
- `CourseOffering`.
- `ClassroomStatus`.
- `CourseOfferingType.EXTRACURRICULAR`.

Agregar temporalmente las nuevas columnas a `Schedule` como opcionales:

- `courseOfferingId`.

### Paso 2: normalizar docentes

A partir de los valores actuales de `Schedule.teacher`:

- Recortar espacios.
- Unificar nombres equivalentes según el catálogo validado.
- Crear un código institucional estable.
- Crear un registro `Teacher` por persona.
- Mantener `teacherId` nulo únicamente cuando el dato realmente no exista, como Excel.

### Paso 3: normalizar materias

A partir de `Schedule.title`:

- Crear las 55 materias regulares.
- Crear las materias especiales:
  - Inglés.
  - Excel.
  - Aula Común como actividad.
- Separar código base y comisión cuando sea posible.
- No interpretar automáticamente una etiqueta ambigua sin registrarla para revisión.

### Paso 4: crear comisiones

Para cada combinación de semestre, materia, comisión y docente:

- Crear un `CourseOffering`.
- Asignar el tipo correcto.
- Asociar el docente correspondiente.
- Asociar la comisión original, por ejemplo `A`, `B`, `Z1`, `10/4` o `5/5`.

### Paso 5: vincular horarios

Completar `Schedule.courseOfferingId` para todos los registros existentes.

Antes de volver obligatorio el campo, debe cumplirse:

```text
cantidad de schedules sin courseOfferingId = 0
```

### Paso 6: migrar estados de aulas

Conversión inicial:

```text
active = true  -> ACTIVA
active = false -> INACTIVA
```

Luego revisar mantenimientos abiertos y actualizar los estados correspondientes.

### Paso 7: corregir seed

El seed deberá incluir:

- 8 aulas reales, incluyendo D201.
- 9 turnos oficiales.
- Semestre `2026-A`.
- 55 materias regulares.
- Materias especiales.
- 30 docentes.
- Los 110 bloques normalizados.
- Tipos correctos para Excel, Inglés y Aula Común.

### Paso 8: endurecer el esquema

Después de verificar la migración:

- Hacer `courseOfferingId` obligatorio.
- Eliminar `title`.
- Eliminar `teacher`.
- Eliminar `active` de `Classroom`.
- Eliminar `MANTENIMIENTO` de los tipos de horario.
- Crear índices y restricciones definitivas.

## 9. Servicios de aplicación

### 9.1 Servicio de materias

Debe permitir:

- Listar materias activas e inactivas.
- Crear una materia con código único.
- Editar nombre o estado.
- Evitar eliminar físicamente materias con historial.

### 9.2 Servicio de docentes

Debe permitir:

- Listar docentes.
- Crear y editar docentes.
- Activar y desactivar docentes.
- Impedir asignaciones nuevas a docentes inactivos.

### 9.3 Servicio de comisiones

Debe permitir:

- Crear una comisión para un semestre y materia.
- Asignar o cambiar docente.
- Definir sección.
- Diferenciar clases regulares, extracurriculares y actividades.
- Impedir duplicados dentro del mismo semestre.

### 9.4 Servicio de horarios

El servicio deberá:

1. Validar referencias.
2. Validar estado del aula.
3. Validar semestre y comisión.
4. Validar que el turno sea oficial.
5. Validar celda del aula.
6. Validar conflicto de docente.
7. Validar conflicto de comisión.
8. Ejecutar la creación o modificación dentro de una transacción.
9. Devolver las relaciones completas.

### 9.5 Servicio de mantenimiento

Deberá:

- Crear mantenimientos.
- Actualizar estados.
- Sincronizar el estado del aula.
- Bloquear reservas mientras exista un mantenimiento abierto.
- Registrar quién realizó cada cambio, si el historial institucional lo requiere.

## 10. Contratos de API objetivo

### 10.1 Crear materia

```json
{
  "code": "DD311",
  "name": "Nombre institucional",
  "active": true
}
```

### 10.2 Crear docente

```json
{
  "code": "SORIA",
  "name": "Soria",
  "email": null,
  "active": true
}
```

### 10.3 Crear comisión

```json
{
  "semesterId": "sem-2026-a",
  "subjectId": "sub-dd311",
  "teacherId": "tea-soria",
  "section": "A",
  "type": "CLASE"
}
```

### 10.4 Crear horario

```json
{
  "classroomId": "cls-d302",
  "semesterId": "sem-2026-a",
  "courseOfferingId": "off-dd311-a-2026",
  "dayOfWeek": 1,
  "timeSlotId": "ts-1",
  "note": null
}
```

La respuesta deberá incluir:

- Aula.
- Semestre.
- Turno.
- Materia.
- Comisión.
- Docente.
- Usuario asignador.

No se aceptarán como campos principales `title` ni `teacher`.

## 11. Seed y fuente de datos

El seed deberá separarse en catálogos y bloques:

```text
TIME_SLOTS
CLASSROOMS
TEACHERS
SUBJECTS
SEMESTERS
COURSE_OFFERINGS
SCHEDULES
USERS
```

Los bloques referenciarán códigos o IDs controlados, nunca nombres repetidos:

```ts
{
  semester: "2026-A",
  classroomCode: "D302",
  day: 1,
  period: 1,
  offeringCode: "DD311-A",
}
```

El seed debe ser idempotente:

- Ejecutarlo dos veces no debe duplicar registros.
- Los códigos deben ser estables.
- Los horarios deben utilizar la clave única de celda.
- Los datos históricos no deben eliminarse automáticamente salvo que se defina explícitamente.

## 12. Pruebas requeridas

### Base de datos y migración

- La migración se aplica desde una base vacía.
- La migración se aplica sobre una base con datos actuales.
- No quedan horarios sin comisión.
- No quedan materias o docentes duplicados.
- El seed puede ejecutarse dos veces.

### Materias y docentes

- Código de materia duplicado: error `409`.
- Código de docente duplicado: error `409`.
- Materia inactiva: no puede usarse en una comisión nueva.
- Docente inactivo: no puede asignarse a una comisión nueva.

### Horarios

- Celda duplicada: error `409`.
- Docente en dos aulas simultáneas: error `409`.
- Comisión en dos aulas simultáneas: error `409`.
- Aula inactiva: reserva rechazada.
- Aula en mantenimiento: reserva rechazada.
- Aula fuera de servicio: reserva rechazada.
- Día inválido: error de validación.
- Turno inexistente: error `404` o validación equivalente.
- Semestre y comisión incompatibles: error de validación.

### Mantenimiento

- Mantenimiento abierto bloquea reservas.
- Mantenimiento completado permite volver a reservar si el aula está activa.
- Cambio de estado de aula queda consistente con los mantenimientos abiertos.

### Datos normalizados

- Existen 8 aulas reales.
- Existe D201 sin horarios.
- Existen 9 turnos oficiales.
- Existen 110 bloques normalizados.
- Excel e Inglés son `EXTRACURRICULAR`.
- Aula Común es `ACTIVIDAD`.
- No existen `title` ni `teacher` libres en los horarios migrados.

## 13. Cambios necesarios en el frontend

Después de estabilizar la API:

- Actualizar los tipos compartidos.
- Agregar tipos `Teacher`, `Subject` y `CourseOffering`.
- Reemplazar `schedule.title` por `schedule.courseOffering.subject` y su sección.
- Reemplazar `schedule.teacher` por `schedule.courseOffering.teacher`.
- Mostrar los tipos `CLASE`, `EXTRACURRICULAR` y `ACTIVIDAD`.
- Reemplazar `classroom.active` por `classroom.status`.
- Deshabilitar acciones de reserva cuando el aula no esté disponible.
- Actualizar formularios para seleccionar materia, comisión y docente desde catálogos.
- Evitar inputs de texto libre para códigos y docentes.

## 14. Estrategia de implementación

La implementación se dividirá en fases pequeñas y verificables.

### Fase 1: esquema

- Modificar `schema.prisma`.
- Crear migración.
- Generar cliente Prisma.
- Ejecutar validación y build.

### Fase 2: catálogos

- Crear modelos, tipos, servicios y rutas de docentes y materias.
- Agregar pruebas unitarias e integración.

### Fase 3: comisiones

- Crear `CourseOffering`.
- Implementar relaciones y validaciones de semestre, materia y docente.

### Fase 4: horarios

- Cambiar el contrato de creación y edición.
- Implementar validaciones de aula, docente y comisión.
- Implementar transacciones.

### Fase 5: mantenimiento

- Implementar `ClassroomStatus`.
- Sincronizar mantenimientos y disponibilidad.
- Agregar pruebas de bloqueo.

### Fase 6: migración y seed

- Migrar los datos existentes.
- Cargar los catálogos normalizados.
- Cargar los 110 bloques.
- Verificar recuentos y relaciones.

### Fase 7: frontend

- Actualizar tipos y componentes.
- Ajustar formularios y grillas.
- Verificar flujos completos desde la interfaz.

### Fase 8: retiro de compatibilidad antigua

- Eliminar `title` y `teacher`.
- Eliminar `active` de aulas.
- Eliminar el tipo `MANTENIMIENTO` de horarios.
- Retirar contratos antiguos y adaptadores temporales.

## 15. Criterios de aceptación

El trabajo se considerará correcto cuando:

- La API compile sin errores.
- Prisma valide el esquema y las migraciones se apliquen correctamente.
- La suite completa de pruebas pase.
- El seed cargue el modelo normalizado sin duplicados.
- Los 110 bloques estén relacionados con una comisión válida.
- No exista ningún horario con materia o docente como texto libre.
- Las restricciones de celda, docente y comisión funcionen.
- Las aulas no disponibles rechacen reservas.
- El frontend pueda crear y visualizar horarios usando catálogos.
- La documentación de endpoints y datos refleje el modelo final.

## 16. Decisiones que deben confirmarse antes de implementar

Antes de modificar código hay que confirmar:

1. Si se adopta `CourseOffering` como entidad intermedia entre materia, docente, semestre y horario.
2. Si una materia se identifica con código base, por ejemplo `DD311`, y la comisión queda en `section`, por ejemplo `A`.
3. Si las actividades como `Aula Común` se almacenan también como `CourseOffering` de tipo `ACTIVIDAD`.
4. Si el mantenimiento bloquea el aula completa mientras esté abierto.
5. Si se requiere bloquear solo franjas específicas mediante `MaintenanceBlock`.
6. Si el cambio de estado del aula será automático, manual o mixto.
7. Si se permitirá planificar horarios en semestres inactivos.
8. Si los códigos de docentes serán definidos por la institución o generados temporalmente durante la migración.
9. Si los horarios históricos deben conservarse indefinidamente.
10. Si `Subject.code` debe almacenar códigos base y `CourseOffering` representar códigos visibles como `DD311-A`.

## 17. Resultado esperado

Al finalizar, la API tendrá una única fuente de verdad para cada concepto:

- `Classroom`: aula física y estado operativo.
- `TimeSlot`: turno oficial.
- `Semester`: período académico.
- `Subject`: materia institucional.
- `Teacher`: docente institucional.
- `CourseOffering`: materia dictada, comisión y docente en un semestre.
- `Schedule`: ubicación temporal y física de la comisión.
- `MaintenanceLog`: mantenimiento e incidencias del aula.
- `User`: usuario que administra o asigna información.

Con esta estructura, los horarios dejarán de depender de texto libre y las relaciones académicas y operativas podrán validarse tanto desde la API como desde la base de datos.
