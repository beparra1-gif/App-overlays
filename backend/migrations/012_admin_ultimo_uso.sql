ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_uso_en TIMESTAMPTZ;

-- Cuenta de super admin pedida explícitamente por el dueño del proyecto.
UPDATE usuarios SET es_admin = true WHERE email = 'beparra1@gmail.com';
