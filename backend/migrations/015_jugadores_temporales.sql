ALTER TABLE jugadores
  ADD COLUMN temporal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_jugadores_partido ON jugadores(partido_id);
