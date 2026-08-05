ALTER TABLE logos
  ADD COLUMN categoria TEXT NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_logos_nombre_categoria ON logos(user_id, nombre, categoria);

ALTER TABLE equipos
  ADD COLUMN borrador BOOLEAN NOT NULL DEFAULT false;

-- Los "Local"/"Visita" que ya existan y no tengan ningún jugador cargado son
-- casi con certeza el placeholder de un juego rápido, nunca un equipo real
-- — se marcan como borrador para que dejen de aparecer en la lista de
-- Equipos (de acá en más, POST /equipos ya los crea así directamente).
UPDATE equipos e
SET borrador = true
WHERE e.nombre IN ('Local', 'Visita')
  AND NOT EXISTS (SELECT 1 FROM jugadores j WHERE j.equipo_id = e.id);
