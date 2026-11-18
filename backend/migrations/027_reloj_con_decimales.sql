-- El reloj se guardaba en segundos ENTEROS y cada pausa truncaba lo ya
-- corrido (hasta casi 1 s de error por cada play/pausa, acumulable). Ahora
-- guarda la fracción exacta; la pantalla sigue mostrando mm:ss.
ALTER TABLE partidos ALTER COLUMN reloj_segundos TYPE DOUBLE PRECISION USING reloj_segundos::double precision;
