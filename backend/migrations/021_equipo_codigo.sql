-- Código corto del equipo (ej. "CHI", "USA") — opcional, para plantillas de
-- marcador tipo transmisión que necesitan un identificador de pocas letras
-- en vez del nombre completo ("FIBA Broadcast" es la primera en usarlo).
-- Sin cargar uno, esas plantillas siguen mostrando el nombre completo,
-- igual que siempre.
ALTER TABLE equipos ADD COLUMN codigo TEXT;
