ALTER TABLE partidos
  ADD COLUMN convocados_local_ids INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN convocados_visita_ids INTEGER[] NOT NULL DEFAULT '{}';
