CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  logo_url TEXT,
  color TEXT NOT NULL DEFAULT '#0a84ff',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jugadores (
  id SERIAL PRIMARY KEY,
  equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  dorsal INTEGER,
  nombre TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partidos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  public_token TEXT UNIQUE NOT NULL,
  equipo_local_id INTEGER NOT NULL REFERENCES equipos(id),
  equipo_visita_id INTEGER NOT NULL REFERENCES equipos(id),
  estado TEXT NOT NULL DEFAULT 'prepartido',
  periodo INTEGER NOT NULL DEFAULT 1,
  reloj_segundos INTEGER NOT NULL DEFAULT 600,
  reloj_corriendo BOOLEAN NOT NULL DEFAULT false,
  reloj_referencia_en TIMESTAMPTZ,
  pts_local INTEGER NOT NULL DEFAULT 0,
  pts_visita INTEGER NOT NULL DEFAULT 0,
  faltas_local INTEGER NOT NULL DEFAULT 0,
  faltas_visita INTEGER NOT NULL DEFAULT 0,
  quinteto_local_ids INTEGER[] NOT NULL DEFAULT '{}',
  quinteto_visita_ids INTEGER[] NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eventos_partido (
  id SERIAL PRIMARY KEY,
  partido_id INTEGER NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  jugador_id INTEGER REFERENCES jugadores(id),
  equipo TEXT,
  puntos INTEGER,
  detalle TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patrocinadores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  imagen_url TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  duracion_segundos INTEGER NOT NULL DEFAULT 8,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jugadores_equipo ON jugadores(equipo_id);
CREATE INDEX IF NOT EXISTS idx_partidos_user ON partidos(user_id);
CREATE INDEX IF NOT EXISTS idx_eventos_partido ON eventos_partido(partido_id);
CREATE INDEX IF NOT EXISTS idx_patrocinadores_user ON patrocinadores(user_id);
