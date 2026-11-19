// Autoprueba de la corrección de dígitos del lector: node src/lector/ocr.check.mjs
import assert from 'node:assert/strict';
import { corregirLectura, parsearReloj, parsearEntero } from './ocr.js';

const reloj = (t, ref, max = 600) => corregirLectura(t, (x) => parsearReloj(x, ref), { posible: (v) => v <= max, referencia: ref, cerca: 75 });
const pts = (t, ref) => corregirLectura(t, (x) => parsearEntero(x, 299), { referencia: ref, cerca: 6 });

assert.equal(reloj('89:12', 553), 552); // 09:12 leído como 89:12
assert.equal(reloj('89:12', null), 552); // sin referencia: única variante posible
assert.equal(reloj('09:12', 553), 552); // lectura buena, intacta
assert.equal(reloj('08:59', 540), 539); // cambio real cercano, intacto
assert.equal(reloj('10:00', null), 600);
assert.equal(pts('68', 60), 60); // 60 leído como 68
assert.equal(pts('62', 60), 62); // un doble de verdad
assert.equal(pts('88', 58), 58); // 58 leído como 88
assert.equal(pts('90', 80), 80); // 80 leído como 90
console.log('ocr.check: ok');

// Detección automática: reloj partido en dos palabras, puntajes y cuarto.
import { zonasDesdePalabras } from './ocr.js';
const w = (text, x0, y0, x1, y1) => ({ text, bbox: { x0, y0, x1, y1 } });
const z = zonasDesdePalabras([
  w('09', 800, 100, 880, 180), w('12', 900, 100, 980, 180), // reloj sin los dos puntos
  w('58', 300, 400, 420, 520), w('61', 1500, 400, 1620, 520), // puntajes
  w('3', 940, 440, 980, 500), w('2', 100, 900, 110, 910), // cuarto y ruido
], 1920, 1080);
assert.ok(z.reloj && z.reloj.x < 800 / 1920 && z.reloj.x + z.reloj.w > 980 / 1920, 'reloj');
assert.ok(z.ptsLocal.x < z.ptsVisita.x, 'local a la izquierda');
assert.ok(z.periodo && z.periodo.x > z.ptsLocal.x && z.periodo.x < z.ptsVisita.x, 'cuarto');
assert.ok(zonasDesdePalabras([w('89:12', 0, 0, 100, 50)], 1920, 1080, 600).reloj); // se ubica aunque un dígito venga mal
assert.deepEqual(zonasDesdePalabras([w('99:99', 0, 0, 100, 50)], 1920, 1080, 600), {}); // eso no es un reloj
console.log('detección: ok');
