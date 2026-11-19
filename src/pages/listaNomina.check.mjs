// Autoprueba: node src/pages/listaNomina.check.mjs
import assert from 'node:assert/strict';
import { parsearListaNomina as p } from './listaNomina.js';
assert.deepEqual(p('7 Ana Torres'), [{ dorsal: '7', nombre: 'Ana Torres' }]);
assert.deepEqual(p('#12 - Sofía Díaz'), [{ dorsal: '12', nombre: 'Sofía Díaz' }]);
assert.deepEqual(p('10\tCamila Muñoz'), [{ dorsal: '10', nombre: 'Camila Muñoz' }]);
assert.deepEqual(p('Pía Acuña 66'), [{ dorsal: '66', nombre: 'Pía Acuña' }]);
assert.deepEqual(p('Solo Nombre'), [{ dorsal: null, nombre: 'Solo Nombre' }]);
assert.equal(p('4 A\r\n\r\n5 B\n').length, 2);
console.log('listaNomina: ok');
