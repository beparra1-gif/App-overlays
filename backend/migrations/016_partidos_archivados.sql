CREATE TABLE IF NOT EXISTS partidos_archivados (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  partido_id INTEGER REFERENCES partidos(id) ON DELETE SET NULL,
  equipo_local_nombre TEXT NOT NULL,
  equipo_visita_nombre TEXT NOT NULL,
  equipo_local_color TEXT,
  equipo_visita_color TEXT,
  equipo_local_logo_url TEXT,
  equipo_visita_logo_url TEXT,
  pts_local INTEGER NOT NULL DEFAULT 0,
  pts_visita INTEGER NOT NULL DEFAULT 0,
  resumen JSONB NOT NULL,
  jugado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partidos_archivados_user ON partidos_archivados(user_id);
