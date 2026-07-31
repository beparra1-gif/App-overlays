-- Cuentas de Google no traen contraseña propia (se autentican con Google,
-- no con password_hash) — deja de ser obligatoria.
ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- Tokens de un solo uso para "olvidé mi contraseña" — se guarda el HASH del
-- token (no el token en sí), mismo criterio que password_hash: si alguien
-- lee la tabla no puede reconstruir un enlace de reseteo válido.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  usado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);
