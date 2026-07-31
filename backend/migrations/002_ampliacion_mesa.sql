ALTER TABLE eventos_partido ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS timeouts_local INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS timeouts_visita INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS posesion TEXT,
  ADD COLUMN IF NOT EXISTS plantilla_marcador TEXT NOT NULL DEFAULT 'clasico',
  ADD COLUMN IF NOT EXISTS stats_display JSONB NOT NULL DEFAULT '{"modo":"equipo","equipo":"local"}'::jsonb;

CREATE TABLE IF NOT EXISTS logos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  filename TEXT UNIQUE NOT NULL,
  mime_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logos_user ON logos(user_id);
