-- Las 25 plantillas de marcador viven como código (src/marcadores/registro.js),
-- no como filas en la base — así que "eliminar una plantilla completa del
-- catálogo" no puede ser un DELETE sobre datos de un usuario (eso ya existía,
-- ver disenos_guardados: borra solo la personalización de ESE usuario para
-- esa plantilla, la tarjeta sigue apareciendo en blanco). Esta tabla es la
-- lista global de plantillas que el super admin decidió sacar del catálogo
-- para TODOS — el catálogo (25 tarjetas) filtra contra esto y muestra 24 (o
-- las que queden). Queda como "ocultar" en vez de un borrado irreversible de
-- verdad: el componente de la plantilla sigue existiendo en el código (un
-- partido/escena viejo que ya la usaba se sigue viendo bien en OBS), y el
-- admin puede restaurarla si se equivocó.
CREATE TABLE IF NOT EXISTS plantillas_ocultas (
  plantilla_id TEXT PRIMARY KEY,
  ocultada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
