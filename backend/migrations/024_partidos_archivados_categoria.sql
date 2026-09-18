-- Categoría/rama de cada equipo AL MOMENTO de archivar el partido — igual
-- que el nombre/color/logo (ya denormalizados acá), se copia una foto fija
-- en vez de ir a buscarla a `equipos` en cada consulta: si el equipo se
-- edita o se borra después, la temporada/liga sigue viendo el partido en
-- la categoría correcta, tal como se jugó. Es la base para agrupar
-- partidos en "temporadas" automáticamente por categoría del club, sin
-- necesitar una tabla de temporadas aparte.
ALTER TABLE partidos_archivados
  ADD COLUMN equipo_local_categoria TEXT,
  ADD COLUMN equipo_local_rama TEXT,
  ADD COLUMN equipo_visita_categoria TEXT,
  ADD COLUMN equipo_visita_rama TEXT;

CREATE INDEX IF NOT EXISTS idx_partidos_archivados_categoria ON partidos_archivados(user_id, equipo_local_categoria, equipo_local_rama);
