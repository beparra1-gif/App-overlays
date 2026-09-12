-- Ajuste manual de faltas personales por jugador — las faltas se calculan
-- 100% sumando eventos_partido (no hay columna base que corregir, a
-- diferencia del marcador: pts_local/pts_visita sí son columnas directas
-- que corregirPuntos sobreescribe). Este ajuste es un delta que se suma al
-- conteo derivado de eventos, mismo espíritu que la corrección de marcador
-- pero sin pisar el historial de jugadas — ver corregirFaltas en
-- estadoPartido.js.
ALTER TABLE jugadores
  ADD COLUMN faltas_ajuste INTEGER NOT NULL DEFAULT 0;
