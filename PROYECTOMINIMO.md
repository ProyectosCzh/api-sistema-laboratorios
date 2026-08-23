# Documentación Técnica del Sistema de Gestión de Aulas y Laboratorios

## 1. Introducción y Resumen del Proyecto
El presente sistema tiene como objetivo principal la administración integral de aulas y laboratorios dentro de una institución educativa. A través de una interfaz web, el sistema permite la gestión de usuarios, la configuración de horarios y semestres, el registro de reservas, el seguimiento de incidencias y la consulta de disponibilidad en tiempo real. El sistema se estructura en torno a una **Tabla Semanal de Disponibilidad** central, la cual es alimentada y consultada por los distintos módulos operativos y administrativos para garantizar la correcta asignación de espacios físicos.

## 2. Roles y Permisos del Sistema
El sistema contempla dos roles de usuario principales, cada uno con un panel de control específico:

- **Encargado (Administrador):** Posee control completo sobre el sistema. Es responsable de la configuración general, la gestión de usuarios, la administración de aulas, la definición de horarios y la supervisión de todas las reservas y anotaciones. Accede al **Panel de Administración**.
- **Ayudante de Laboratorio (Operador):** Posee un rol operativo centrado en el uso diario de las instalaciones. Es responsable de consultar horarios, registrar reservas de aulas, añadir anotaciones de uso y verificar el estado de los espacios. Accede al **Panel Operativo**.

## 3. Flujo de Autenticación
El proceso de acceso al sistema comienza con la acción de "Acceder al sistema". El sistema verifica si el usuario está autenticado mediante una condición de decisión. 
- Si la respuesta es **No**, se muestra un mensaje de "Acceso denegado" y el flujo regresa al inicio del proceso de autenticación.
- Si la respuesta es **Sí**, el sistema consulta el "Tipo de usuario" para redirigir al individuo a su respectivo panel de control (Administración u Operativo).

## 4. Módulo de Administración (Encargado)

### 4.1. Gestión de Usuarios y Permisos
Este submódulo permite al Encargado crear, modificar o desactivar cuentas de usuario. Posteriormente, se asignan roles y permisos específicos a cada cuenta, definiendo si el usuario tendrá el rol de "Encargado con control completo" o de "Ayudante con reservas y anotaciones". Esta información se almacena en la entidad de **Datos de Usuarios**.

### 4.2. Gestión de Aulas
El Encargado tiene la capacidad de registrar nuevas aulas en el sistema. Al registrar un aula, se debe definir su tipo: "Aula convencional", "Laboratorio con computadoras" u "Otro tipo de aula". Además, puede consultar el estado actual de las aulas y registrar periodos de mantenimiento. Los datos resultantes se almacenan en **Datos de Aulas** y **Datos de Mantenimiento**.

### 4.3. Configuración de Semestres y Horarios
Este módulo es fundamental para la planificación académica. El proceso sigue una secuencia lógica: primero se selecciona el semestre, luego se definen los días de la semana hábiles, posteriormente se definen los bloques horarios y finalmente se publica el calendario semanal. Toda esta configuración alimenta la **Tabla Semanal de Disponibilidad** y se almacena en **Datos de Semestres y Horarios**.

### 4.4. Consulta de Disponibilidad y Reportes
El Encargado puede consultar la disponibilidad de los espacios a través de cuatro perspectivas: consultar ocupación, consultar mantenimientos, consultar historial de reservas y consultar incidencias/anotaciones. Esta información puede ser consolidada para generar reportes administrativos.

### 4.5. Supervisión de Reservas y Anotaciones
Este módulo permite al Encargado revisar toda la información registrada por el personal operativo. Puede confirmar, modificar o cancelar reservas, así como dar seguimiento a las anotaciones de uso. En caso de que una anotación derive en una incidencia, el flujo continúa hacia la evaluación de la misma.

## 5. Módulo Operativo (Ayudante de Laboratorio)

### 5.1. Consulta de Aulas y Horarios
El Ayudante tiene acceso directo a la información de aulas y horarios publicados para conocer la disponibilidad general sin necesidad de modificar datos.

### 5.2. Registro de Reservas
Para registrar una reserva, el Ayudante debe seleccionar el aula, el día y el horario deseado. El sistema valida la disponibilidad mediante una condición. 
- Si el aula **No** está disponible (por conflicto o mantenimiento), se informa del problema.
- Si el aula **Sí** está disponible, se registra la reserva, se actualiza el calendario y el estado del aula pasa a ser **"Ocupada"**. Esta acción genera registros en **Datos de Reservas**.

### 5.3. Registro de Anotaciones de Uso
El Ayudante puede añadir anotaciones sobre el uso de un aula seleccionando el espacio y el periodo correspondiente. Tras registrar la anotación y guardar la observación, el sistema evalúa si la situación requiere atención. 
- Si **No** requiere atención, la información se consolida en la tabla de disponibilidad.
- Si **Sí** requiere atención, se notifica al Encargado, quien evaluará la incidencia. Si la evaluación determina que se requiere mantenimiento, el flujo se desvía al submódulo de "Registrar mantenimiento". Esta información se almacena en **Datos de Anotaciones**.

### 5.4. Consulta de Estado del Aula
El Ayudante puede consultar el estado actual de un aula específica. El sistema evalúa el estado y presenta tres posibles resultados:
- **Libre:** El aula está disponible para reservar.
- **Ocupada:** El aula está en clase o con una actividad reservada.
- **Mantenimiento:** El aula no está disponible para uso.

## 6. Modelo de Datos (Entidades)
El sistema se apoya en seis entidades de datos fundamentales que interactúan entre sí para mantener la coherencia de la información. Estas son:
- **Datos de Reservas:** Almacena las reservas activas y pasadas.
- **Datos de Anotaciones:** Almacena las observaciones y notas de uso.
- **Datos de Mantenimiento:** Registra los periodos en que un aula está fuera de servicio.
- **Datos de Aulas:** Contiene la información física y tipológica de los espacios.
- **Datos de Usuarios:** Gestiona cuentas, roles y permisos.
- **Datos de Semestres y Horarios:** Define la estructura temporal de la institución.

Todas estas entidades convergen para actualizar y mantener la **Tabla Semanal de Disponibilidad**.

## 7. Tabla Semanal de Disponibilidad (Núcleo del Sistema)
Este es el componente central que refleja la ocupación de los espacios. La tabla se estructura en una matriz de días y horas:
- **Días de la semana:** Lunes, Martes, Miércoles, Jueves, Viernes y Sábado.
- **Bloques horarios definidos:** 
  - 07:15 - 08:45
  - 08:55 - 10:25
  - 10:30 - 12:00
  - 12:20 - 13:50
  - 13:55 - 15:25
  - 15:30 - 17:00
  - 17:05 - 18:35
  - 18:40 - 20:10
  - 20:15 - 21:45

## 8. Reglas de Negocio y Consideraciones Clave
- **Bloqueo por Mantenimiento:** Cuando un aula es marcada con estado "Mantenimiento" (tras una incidencia), el sistema impide automáticamente que se registren nuevas reservas para ese periodo, actualizando la tabla semanal.
- **Bucle de Autenticación:** El sistema no permite el acceso a usuarios no autenticados, redirigiéndolos de vuelta al inicio.
- **Derivación de Incidencias:** Las anotaciones de uso con requerimientos de atención generan una notificación al Encargado, quien puede convertirlas en un proceso de mantenimiento formal, cerrando el ciclo operativo-administrativo.
- **Centralización:** Toda acción operativa (reservas, anotaciones, mantenimiento) y administrativa (configuración) impacta directamente en la "Tabla Semanal de Disponibilidad", garantizando que todos los usuarios vean información actualizada y veraz en tiempo real.