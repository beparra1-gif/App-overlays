-- Reloj de posesión (24") y tiempos muertos FIBA (2 en la primera mitad).
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS posesion_segundos DOUBLE PRECISION NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS posesion_corriendo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posesion_referencia_en TIMESTAMPTZ;
ALTER TABLE partidos ALTER COLUMN timeouts_local SET DEFAULT 2;
ALTER TABLE partidos ALTER COLUMN timeouts_visita SET DEFAULT 2;
