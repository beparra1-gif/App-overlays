-- Categoría (ej. "Sub-15", "Primera") y rama (femenino/masculino) del
-- equipo — se piden al cargarlo en "Equipos" para poder distinguir varios
-- equipos del mismo club/nombre por edad y género, pero NUNCA se muestran
-- en los selectores de "elegir equipo" (Mesa de control, reinicio de
-- partido, etc.) — ahí solo se ve el nombre, ver EquipoFicha.jsx /
-- ModalReiniciar en Mesa.jsx.
ALTER TABLE equipos
  ADD COLUMN categoria TEXT,
  ADD COLUMN rama TEXT;
