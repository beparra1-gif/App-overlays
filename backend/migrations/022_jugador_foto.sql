-- Foto de jugador (opcional) — misma idea que "logos" (bytes guardados en
-- una tabla aparte, servidos por su propia ruta), para no engordar la fila
-- de "jugadores" (que se lee muy seguido, en cada jugada) con una columna
-- bytea pesada. `tiene_foto` en jugadores es la señal barata para saber si
-- hay que pedir la imagen, sin tener que hacer un JOIN en cada consulta de
-- roster.
CREATE TABLE jugador_fotos (
  jugador_id INTEGER PRIMARY KEY REFERENCES jugadores(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE jugadores ADD COLUMN tiene_foto BOOLEAN NOT NULL DEFAULT false;
