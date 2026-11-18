-- El ajuste manual de faltas personales (ver 020_faltas_ajuste.sql) vivía
-- en `jugadores`, o sea POR JUGADOR y no por partido: una corrección hecha
-- en un partido seguía sumándose en el siguiente partido de ese mismo
-- jugador. Ahora el ajuste se guarda en el partido, como un mapa
-- { "<jugadorId>": delta }, y se vacía solo al reiniciar el partido.
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS faltas_ajuste JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Se conservan los ajustes ya cargados en partidos EN CURSO (para no perder
-- una corrección hecha en un partido que se está jugando ahora mismo).
UPDATE partidos p
SET faltas_ajuste = sub.mapa
FROM (
  SELECT p2.id, jsonb_object_agg(j.id::text, j.faltas_ajuste) AS mapa
  FROM partidos p2
  JOIN jugadores j ON j.equipo_id IN (p2.equipo_local_id, p2.equipo_visita_id)
  WHERE p2.estado = 'en_curso' AND j.faltas_ajuste <> 0
  GROUP BY p2.id
) sub
WHERE p.id = sub.id;

UPDATE jugadores SET faltas_ajuste = 0 WHERE faltas_ajuste <> 0;
