-- Antes de esta migración se podían crear varios "disenos_guardados" para
-- la misma plantilla del mismo usuario (cada click en "Usar este diseño"
-- del catálogo creaba uno nuevo). El modelo pasa a ser uno solo por
-- (usuario, plantilla): se limpia lo duplicado, quedándose con el que tenga
-- un partido activo (el que el usuario realmente está usando) o, si ninguno
-- lo tiene, con el más reciente.
WITH ranked AS (
  SELECT id, user_id, plantilla_base,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, plantilla_base
      ORDER BY (partido_activo_id IS NOT NULL) DESC, creado_en DESC, id DESC
    ) AS rn
  FROM disenos_guardados
)
DELETE FROM disenos_guardados d
USING ranked r
WHERE d.id = r.id AND r.rn > 1;

ALTER TABLE disenos_guardados
  ADD CONSTRAINT disenos_guardados_user_plantilla_unico UNIQUE (user_id, plantilla_base);
