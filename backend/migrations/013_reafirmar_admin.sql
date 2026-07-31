-- 012 marcó a beparra1@gmail.com como admin, pero esa UPDATE corrió una sola
-- vez al momento del deploy que agregó la columna — si esa cuenta todavía no
-- existía en la base en ese instante (por ejemplo, si el primer login con
-- Google en producción pasó recién después), la UPDATE no encontró ninguna
-- fila y nunca se volvió a intentar. Esta migración repite la misma UPDATE
-- (idempotente, sin efecto si ya estaba en true) para que quede aplicada sin
-- importar el orden en que se creó la cuenta.
UPDATE usuarios SET es_admin = true WHERE email = 'beparra1@gmail.com';
