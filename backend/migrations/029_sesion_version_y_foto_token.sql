-- Versión de sesión: cambiar/recuperar la contraseña o vincular Google la
-- sube, y todos los tokens emitidos antes dejan de valer.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_version INTEGER NOT NULL DEFAULT 0;

-- Fotos de jugadoras: se sirven por un token al azar (no por el id, que es
-- correlativo y permitía recorrer las fotos de todas las cuentas).
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS foto_token TEXT;
UPDATE jugadores SET foto_token = replace(gen_random_uuid()::text, '-', '') WHERE tiene_foto AND foto_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jugadores_foto_token_idx ON jugadores (foto_token);
