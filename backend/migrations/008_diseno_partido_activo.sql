ALTER TABLE disenos_guardados
  ADD COLUMN IF NOT EXISTS partido_activo_id INTEGER REFERENCES partidos(id) ON DELETE SET NULL;
