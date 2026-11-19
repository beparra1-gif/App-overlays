-- Enlaces de operador (manejan la Mesa sin acceso al resto de la cuenta).
-- Subir esta versión anula todos los enlaces de operador ya entregados.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS operador_version INTEGER NOT NULL DEFAULT 0;
