CREATE TABLE IF NOT EXISTS disenos_guardados (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  plantilla_base TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escenas (
  id SERIAL PRIMARY KEY,
  partido_id INTEGER NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  diseno_id INTEGER REFERENCES disenos_guardados(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  public_token TEXT UNIQUE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disenos_user ON disenos_guardados(user_id);
CREATE INDEX IF NOT EXISTS idx_escenas_partido ON escenas(partido_id);
CREATE INDEX IF NOT EXISTS idx_escenas_token ON escenas(public_token);

ALTER TABLE partidos DROP COLUMN IF EXISTS plantilla_marcador;
ALTER TABLE partidos DROP COLUMN IF EXISTS stats_display;

-- Backfill: crea las 4 escenas por defecto para partidos que todavía no las tengan
-- (los creados antes de este modelo). Token generado con md5 sobre datos aleatorios
-- y de contexto — no depende de extensiones (pgcrypto) que puedan no estar habilitadas.
INSERT INTO escenas (partido_id, tipo, nombre, public_token, config)
SELECT
  p.id,
  t.tipo,
  t.nombre,
  md5(random()::text || clock_timestamp()::text || p.id::text || t.tipo),
  t.config::jsonb
FROM partidos p
CROSS JOIN (
  VALUES
    ('marcador', 'Marcador', '{}'),
    ('nomina', 'Nómina', '{}'),
    ('estadisticas', 'Estadísticas', '{"modo":"equipo","equipo":"local"}'),
    ('anuncios', 'Anuncios', '{}')
) AS t(tipo, nombre, config)
WHERE NOT EXISTS (
  SELECT 1 FROM escenas e WHERE e.partido_id = p.id AND e.tipo = t.tipo
);
