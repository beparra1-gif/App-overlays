// Reglas de juego (FIBA) y reloj: `npm test` en backend/. No toca la base.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  relojActual, relojPosesionActual, esDescalificado, timeoutsIniciales, tramoDeTimeouts, timeoutsDisponibles, FALTAS_BONUS,
} from '../socket/estadoPartido.js';

const hace = (seg) => new Date(Date.now() - seg * 1000).toISOString();

test('reloj: parado devuelve lo guardado; corriendo descuenta con fracción y nunca baja de 0', () => {
  assert.equal(relojActual({ reloj_segundos: 600, reloj_corriendo: false }), 600);
  const corriendo = relojActual({ reloj_segundos: 600, reloj_corriendo: true, reloj_referencia_en: hace(10.5) });
  assert.ok(corriendo > 589.3 && corriendo <= 589.5, `esperaba ~589.5, dio ${corriendo}`);
  assert.equal(relojActual({ reloj_segundos: 5, reloj_corriendo: true, reloj_referencia_en: hace(9) }), 0);
});

test('posesión: 24 por defecto y nunca negativa', () => {
  assert.equal(relojPosesionActual({}), 24);
  assert.equal(relojPosesionActual({ posesion_segundos: 3, posesion_corriendo: true, posesion_referencia_en: hace(10) }), 0);
});

test('FIBA: bonus desde la 4ª falta de equipo', () => {
  assert.equal(FALTAS_BONUS, 4);
});

test('FIBA: descalificación', () => {
  const j = (p = 0, t = 0, a = 0, d = 0) => ({ faltasPersonales: p, faltasTecnicas: t, faltasAntideportivas: a, faltasDescalificantes: d });
  assert.equal(esDescalificado(j(4)), false);
  assert.equal(esDescalificado(j(5)), true);
  assert.equal(esDescalificado(j(3, 1, 1)), true); // 1 técnica + 1 antideportiva
  assert.equal(esDescalificado(j(0, 2)), true);
  assert.equal(esDescalificado(j(0, 0, 2)), true);
  assert.equal(esDescalificado(j(0, 0, 0, 1)), true);
  assert.equal(esDescalificado(j(3, 1)), false);
});

test('FIBA: tiempos muertos 2/3/1 y por mitades', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(timeoutsIniciales), [2, 2, 3, 3, 1, 1]);
  assert.equal(tramoDeTimeouts(1), tramoDeTimeouts(2));
  assert.notEqual(tramoDeTimeouts(2), tramoDeTimeouts(3));
  assert.notEqual(tramoDeTimeouts(5), tramoDeTimeouts(6)); // cada prórroga es aparte
});

test('FIBA: máximo 2 tiempos muertos en los últimos 2:00 del 4º cuarto', () => {
  const partido = (periodo, reloj) => ({ periodo, reloj_segundos: reloj, reloj_corriendo: false, timeouts_local: 3, timeouts_visita: 1 });
  assert.equal(timeoutsDisponibles(partido(4, 121), 'local'), 3);
  assert.equal(timeoutsDisponibles(partido(4, 120), 'local'), 2);
  assert.equal(timeoutsDisponibles(partido(4, 60), 'visita'), 1);
  assert.equal(timeoutsDisponibles(partido(3, 60), 'local'), 3);
});
