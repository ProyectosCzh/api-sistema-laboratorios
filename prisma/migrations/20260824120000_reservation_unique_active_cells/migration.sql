-- Integridad de reservas (F1): una sola reserva ACTIVA por celda de aula.
-- Los índices parciales no son expresables en schema.prisma, van como SQL crudo.

-- RECURRENTE: una única reserva activa por (aula, semestre, turno, día).
CREATE UNIQUE INDEX "Reservation_active_recurring_cell_key"
ON "Reservation"("classroomId", "semesterId", "timeSlotId", "dayOfWeek")
WHERE "type" = 'RECURRENTE'
  AND "status" IN ('PENDIENTE', 'CONFIRMADA');

-- PUNTUAL: una única reserva activa por (aula, semestre, turno, fecha).
CREATE UNIQUE INDEX "Reservation_active_punctual_cell_key"
ON "Reservation"("classroomId", "semesterId", "timeSlotId", "date")
WHERE "type" = 'PUNTUAL'
  AND "status" IN ('PENDIENTE', 'CONFIRMADA');
