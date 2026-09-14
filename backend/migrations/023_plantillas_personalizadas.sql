-- Plantillas armadas a mano en el Creador de marcador (ver ElementosLibres.jsx
-- / CreadorLibre.jsx) y guardadas por el usuario para reusar como punto de
-- partida — aparecen en el catálogo de "Diseños" junto a las 34 plantillas
-- de fábrica. No es lo mismo que "disenos_guardados": ESA tabla es un
-- diseño YA EN USO por el usuario (con su propio enlace fijo de OBS vía
-- escenas); esta es la "receta" reusable (plantilla_base + config) que se
-- copia al crear un diseño nuevo a partir de ella — el enlace fijo lo
-- sigue generando el mecanismo de siempre (disenos_guardados → escenas),
-- no esta tabla.
CREATE TABLE IF NOT EXISTS plantillas_personalizadas (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  plantilla_base TEXT NOT NULL DEFAULT 'creador-libre',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_personalizadas_user ON plantillas_personalizadas(user_id);
