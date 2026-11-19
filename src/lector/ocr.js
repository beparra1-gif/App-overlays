// Lectura de un marcador físico de estadio por cámara: preprocesado de
// imagen, interpretación del texto del OCR y reglas de "consenso" (cuántas
// lecturas iguales seguidas hacen falta antes de confiar en un valor).
// Sin dependencias de React — se puede probar suelto.

// Zonas del marcador que se pueden encuadrar. x/y/w/h en fracción (0–1)
// del cuadro de video. `tipo` decide cómo se interpreta el texto.
export const ZONAS_POR_DEFECTO = [
  { id: 'reloj', etiqueta: 'Reloj', tipo: 'reloj', color: '#22c55e', x: 0.34, y: 0.08, w: 0.32, h: 0.22, activa: true },
  { id: 'ptsLocal', etiqueta: 'Puntos local', tipo: 'entero', max: 299, color: '#ef4444', x: 0.05, y: 0.40, w: 0.25, h: 0.24, activa: true },
  { id: 'ptsVisita', etiqueta: 'Puntos visita', tipo: 'entero', max: 299, color: '#3b82f6', x: 0.70, y: 0.40, w: 0.25, h: 0.24, activa: true },
  { id: 'periodo', etiqueta: 'Cuarto', tipo: 'entero', max: 9, color: '#f59e0b', x: 0.44, y: 0.44, w: 0.12, h: 0.18, activa: true },
  { id: 'faltasLocal', etiqueta: 'Faltas local', tipo: 'entero', max: 20, color: '#f472b6', x: 0.08, y: 0.72, w: 0.13, h: 0.16, activa: false },
  { id: 'faltasVisita', etiqueta: 'Faltas visita', tipo: 'entero', max: 20, color: '#a78bfa', x: 0.79, y: 0.72, w: 0.13, h: 0.16, activa: false },
  { id: 'posesion', etiqueta: 'Posesión 24"', tipo: 'entero', max: 24, color: '#eab308', x: 0.44, y: 0.68, w: 0.12, h: 0.16, activa: false },
];

// Qué interruptor de "Marcador por cámara" (Mesa) controla cada zona.
export const INTERRUPTOR_POR_ZONA = {
  reloj: 'reloj', ptsLocal: 'puntos', ptsVisita: 'puntos', periodo: 'periodo', faltasLocal: 'faltas', faltasVisita: 'faltas', posesion: 'reloj',
};

const limpiar = (texto) => (texto || '')
  .replace(/\s+/g, '')
  .replace(/[oOD]/g, '0')
  .replace(/[lI|!]/g, '1')
  .replace(/[sS]/g, '5')
  .replace(/[B]/g, '8');

// Reloj de juego → segundos (enteros). Acepta:
//  "10:00", "1000" (sin separador), "9:59", "10.00"/"10;00" (el OCR
//  confunde ":"), y el formato del último minuto que usan muchos
//  marcadores: "45.3" o "45.32" (segundos.décimas/centésimas).
// `previo` (segundos de la lectura anterior) desempata "45.32" entre
// 45 min 32 s y 45,32 s: si veníamos por debajo de ~70 s, son segundos.
export function parsearReloj(textoCrudo, previo = null) {
  const t = limpiar(textoCrudo);
  let m = t.match(/^(\d{1,2})[.,](\d)$/);
  if (m) return Number(m[1]) <= 59 ? Number(m[1]) : null;
  m = t.match(/^(\d{1,2})[:;.,](\d{2})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const separadorPunto = /[.,]/.test(t);
    if (separadorPunto && previo != null && previo < 70 && a <= 59) return a;
    // Ningún período dura más de 20 min: "45.32" con punto son segundos.
    if (separadorPunto && a > 20 && a <= 59) return a;
    if (b > 59) return separadorPunto && a <= 59 ? a : null;
    return a * 60 + b;
  }
  m = t.match(/^(\d{1,2})(\d{2})$/);
  if (m && Number(m[2]) <= 59) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d{1,2})$/);
  if (m && previo != null && previo < 70) return Number(m[1]);
  return null;
}

// Dígitos que el OCR confunde en marcadores LED / 7 segmentos (un 0 con un
// segmento encendido de más se lee 8, un 9 sin la colita se lee 0, etc.).
const PARECIDOS = { 0: '869', 1: '7', 2: '7', 3: '8', 5: '68', 6: '085', 7: '1', 8: '06953', 9: '08' };
const variantesDeUnDigito = (t) => [...t].flatMap((c, i) => [...(PARECIDOS[c] || '')].map((d) => t.slice(0, i) + d + t.slice(i + 1)));

// Si la lectura directa es imposible (p. ej. 89:12 en un cuarto de 10 min)
// o queda lejos de lo esperado (`referencia` ± `cerca`), prueba cambiando
// UN dígito por su parecido y se queda con la variante posible más cercana.
// Sin una variante mejor, devuelve la directa (puede ser un cambio real).
export function corregirLectura(textoCrudo, interpretar, { posible = () => true, referencia = null, cerca = Infinity } = {}) {
  const t = limpiar(textoCrudo);
  const directo = interpretar(t);
  const okDirecto = directo != null && posible(directo);
  const cercano = (v) => referencia == null || Math.abs(v - referencia) <= cerca;
  if (okDirecto && cercano(directo)) return directo;
  const candidatos = [...new Set(variantesDeUnDigito(t).map(interpretar))].filter((v) => v != null && posible(v) && cercano(v));
  if (candidatos.length === 1 || (candidatos.length > 1 && referencia != null)) {
    return candidatos.sort((x, y) => Math.abs(x - (referencia ?? 0)) - Math.abs(y - (referencia ?? 0)))[0];
  }
  return okDirecto ? directo : null;
}

export function parsearEntero(textoCrudo, max = 999) {
  const t = limpiar(textoCrudo).replace(/[^0-9]/g, '');
  if (!t || t.length > 3) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

// Recorta la zona del video, la pasa a gris, estira el contraste según la
// luz REAL del cuadro, la deja siempre "texto oscuro sobre fondo claro"
// (Tesseract lee mucho mejor así; los marcadores LED son al revés) y,
// opcionalmente, engorda los trazos para unir los segmentos de los dígitos
// de 7 segmentos, que si no el OCR ve como rayitas sueltas.
// `fuente`: el <video> o una instantánea (canvas) del cuadro ya tomada.
export function prepararRecorte(video, zona, canvas, { unirSegmentos = true, radio: radioFijo = null } = {}) {
  const vw = video.videoWidth || video.width;
  const vh = video.videoHeight || video.height;
  const sx = Math.max(0, zona.x * vw);
  const sy = Math.max(0, zona.y * vh);
  const sw = Math.max(4, Math.min(vw - sx, zona.w * vw));
  const sh = Math.max(4, Math.min(vh - sy, zona.h * vh));
  // Altura objetivo ~90 px de dígito: lo que mejor lee Tesseract.
  const escala = Math.max(1, Math.min(6, 110 / sh));
  canvas.width = Math.round(sw * escala);
  canvas.height = Math.round(sh * escala);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const n = d.length / 4;
  const gris = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    // Máximo de canales en vez de luminancia: los LED rojos/ámbar quedan
    // tan brillantes como los blancos.
    const v = Math.max(d[i], d[i + 1], d[i + 2]);
    gris[p] = v;
    hist[v]++;
  }
  const percentil = (q) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * q) return v; }
    return 255;
  };
  const bajo = percentil(0.03);
  const alto = percentil(0.97);
  const rango = Math.max(1, alto - bajo);
  // Umbral de Otsu sobre el rango estirado → binario limpio.
  const hist2 = new Uint32Array(256);
  for (let p = 0; p < n; p++) {
    const v = Math.max(0, Math.min(255, Math.round(((gris[p] - bajo) / rango) * 255)));
    gris[p] = v;
    hist2[v]++;
  }
  let suma = 0;
  for (let v = 0; v < 256; v++) suma += v * hist2[v];
  let sumaB = 0, pesoB = 0, mejor = 0, umbral = 128;
  for (let v = 0; v < 256; v++) {
    pesoB += hist2[v];
    if (!pesoB) continue;
    const pesoF = n - pesoB;
    if (!pesoF) break;
    sumaB += v * hist2[v];
    const mB = sumaB / pesoB;
    const mF = (suma - sumaB) / pesoF;
    const entre = pesoB * pesoF * (mB - mF) ** 2;
    if (entre > mejor) { mejor = entre; umbral = v; }
  }
  // ¿Qué es "tinta"? Lo que ocupa MENOS superficie (los dígitos).
  let claros = 0;
  for (let p = 0; p < n; p++) if (gris[p] > umbral) claros++;
  const tintaEsClara = claros < n / 2;
  const tinta = new Uint8Array(n);
  for (let p = 0; p < n; p++) tinta[p] = (gris[p] > umbral) === tintaEsClara ? 1 : 0;

  let final = tinta;
  if (unirSegmentos) {
    const radio = radioFijo ?? Math.max(1, Math.round(canvas.height / 45));
    final = dilatar(tinta, canvas.width, canvas.height, radio);
  }
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const v = final[p] ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Dilatación separable (horizontal y vertical) — rápida y alcanza para
// cerrar los huecos entre segmentos de un dígito LED.
function dilatar(src, w, h, r) {
  const tmp = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let k = -r; k <= r && !on; k++) { const xx = x + k; if (xx >= 0 && xx < w && src[y * w + xx]) on = 1; }
      tmp[y * w + x] = on;
    }
  }
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let k = -r; k <= r && !on; k++) { const yy = y + k; if (yy >= 0 && yy < h && tmp[yy * w + x]) on = 1; }
      out[y * w + x] = on;
    }
  }
  return out;
}

// Consenso: un valor recién se "confirma" cuando sale igual N veces
// seguidas. N depende de qué tan raro sea el cambio respecto del valor
// actual del partido (un +2 en el marcador es normal; un salto de 30, o un
// cambio de cuarto, necesita más pruebas antes de tocar nada).
export function lecturasNecesarias(zonaId, nuevo, actual) {
  if (actual == null) return 2;
  if (zonaId === 'periodo') return 4;
  if (zonaId === 'ptsLocal' || zonaId === 'ptsVisita') {
    const delta = nuevo - actual;
    if (delta >= 1 && delta <= 4) return 2;
    return 4;
  }
  if (zonaId === 'faltasLocal' || zonaId === 'faltasVisita') return nuevo === actual + 1 ? 2 : 3;
  return 2;
}

export function valorConfirmado(historial, zonaId, actual) {
  if (!historial.length) return null;
  const ultimo = historial[historial.length - 1];
  if (ultimo == null) return null;
  const necesarias = lecturasNecesarias(zonaId, ultimo, actual);
  if (historial.length < necesarias) return null;
  const tramo = historial.slice(-necesarias);
  return tramo.every((v) => v === ultimo) ? ultimo : null;
}

// Reloj: corriendo si en la ventana bajó; parado si las últimas 3 son iguales.
export function tendenciaReloj(ventana, previa = 'desconocida') {
  const validas = ventana.filter((v) => v != null);
  if (validas.length < 3) return 'desconocida';
  const tres = validas.slice(-3);
  if (tres.every((v) => v === tres[0])) return 'pausado';
  if (validas[validas.length - 1] < validas[0]) return 'corriendo';
  return previa;
}

// ── Reloj físico: estado y valor a partir de lecturas con la hora exacta
// del cuadro ({ v: segundos mostrados, t: ms }) ──
// Una sola lectura mala del OCR (un 7 leído como 1) no puede decidir nada:
// se descarta la muestra que más se aleja del resto antes de evaluar.
function sinAtipico(muestras, valorDe) {
  if (muestras.length < 4) return muestras;
  const valores = muestras.map(valorDe);
  const ordenados = [...valores].sort((a, b) => a - b);
  const mediana = ordenados[Math.floor(ordenados.length / 2)];
  let peor = -1;
  let distancia = -1;
  valores.forEach((v, i) => { const d = Math.abs(v - mediana); if (d > distancia) { distancia = d; peor = i; } });
  return distancia > 0.9 ? muestras.filter((_, i) => i !== peor) : muestras;
}

// Racha FINAL de lecturas con el mismo valor (tolerando UNA lectura mala
// en el medio o al final): { v, desde, hasta, cantidad } o null.
export function rachaFinal(muestras) {
  for (const referencia of [muestras[muestras.length - 1], muestras[muestras.length - 2]]) {
    if (!referencia) continue;
    let saltos = 0;
    let cantidad = 0;
    let desde = referencia.t;
    let hasta = null;
    for (let i = muestras.length - 1; i >= 0; i--) {
      const m = muestras[i];
      if (m.v === referencia.v) { cantidad++; desde = m.t; if (hasta == null) hasta = m.t; } else if (++saltos > 1) break;
    }
    if (cantidad >= 3 && hasta - desde >= 1500) return { v: referencia.v, desde, hasta, cantidad };
  }
  return null;
}

// Tramo "corriendo" del final: las lecturas posteriores a la última meseta
// (racha de un mismo valor > 1,1 s). La meseta en sí no cuenta: mientras el
// reloj estaba parado, su valor no bajaba con el tiempo.
function tramoCorriendo(muestras) {
  const tramo = [];
  for (let i = muestras.length - 1; i >= 0; i--) {
    const m = muestras[i];
    if (tramo.length && m.v < tramo[0].v) break; // hacia atrás el valor no puede bajar
    tramo.unshift(m);
    const mismos = tramo.filter((x) => x.v === m.v);
    if (mismos.length >= 3 && mismos[mismos.length - 1].t - mismos[0].t > 1500) {
      return { tramo: tramo.filter((x) => x.v !== m.v), meseta: { v: m.v, hasta: mismos[mismos.length - 1].t } };
    }
  }
  return { tramo, meseta: null };
}

// 'pausado': la racha final de un mismo valor dura más de ~1,1 s.
// 'corriendo': (a) venía parado y las 2 últimas lecturas ya están por
// debajo del valor de la pausa — arranque detectado apenas se ve; o (b) en
// los últimos ~2,5 s los valores bajan al ritmo del tiempo real.
export function estadoRelojFisico(muestras, previa = 'desconocida') {
  if (rachaFinal(muestras)) return 'pausado';
  const ultimo = muestras[muestras.length - 1];
  if (!ultimo) return previa;
  const { tramo, meseta } = tramoCorriendo(muestras);
  if (meseta && tramo.length >= 2) {
    const [a, b] = tramo.slice(-2);
    if (a.v < meseta.v && b.v <= a.v && b.v >= meseta.v - 3) return 'corriendo';
  }
  const recientes = (tramo.length >= 3 ? tramo : muestras).filter((m) => ultimo.t - m.t <= 2500);
  if (recientes.length < 3) return previa;
  const t0 = recientes[0].t;
  const corrido = sinAtipico(recientes, (m) => m.v + (m.t - t0) / 1000);
  const residuos = corrido.map((m) => m.v + (m.t - t0) / 1000);
  if (corrido.length >= 3 && Math.max(...residuos) - Math.min(...residuos) <= 1.25 && corrido[0].v - corrido[corrido.length - 1].v >= 1) return 'corriendo';
  return previa;
}

// Valor real del reloj físico en el instante `ahora`, estando corriendo.
// Cada lectura "muestra v" dice que el valor real estaba entre v y v+1
// (entre v-1 y v si el tablero redondea hacia arriba); llevando cada rango
// al instante `ahora` y cruzándolos, el rango se achica a décimas. Si se
// vio el ARRANQUE (fin de una meseta), el cambio de la meseta P al valor
// siguiente pasó exactamente cuando el reloj real valía P: otra cota fina.
export function estimarRelojFisicoDetalle(muestras, ahora, { redondeaArriba = false } = {}) {
  const { tramo, meseta } = tramoCorriendo(muestras);
  const ultimoM = tramo[tramo.length - 1] || muestras[muestras.length - 1];
  if (!ultimoM) return 0;
  const recientes = (tramo.length ? tramo : muestras).filter((m) => ultimoM.t - m.t <= 3000);
  const t0 = recientes[0].t;
  const validas = sinAtipico(recientes, (m) => m.v + (m.t - t0) / 1000);
  const ajuste = redondeaArriba ? -1 : 0;
  let bajo = -Infinity;
  let alto = Infinity;
  for (const m of validas) {
    const corrido = (ahora - m.t) / 1000;
    bajo = Math.max(bajo, m.v + ajuste - corrido);
    alto = Math.min(alto, m.v + 1 + ajuste - corrido);
  }
  if (meseta && tramo.length) {
    const primero = tramo[0];
    if (primero.v === meseta.v - 1) {
      // El cambio meseta→primero ocurrió entre meseta.hasta y primero.t.
      bajo = Math.max(bajo, meseta.v + ajuste - (ahora - meseta.hasta) / 1000);
      alto = Math.min(alto, meseta.v + ajuste - (ahora - primero.t) / 1000);
    }
  }
  if (bajo < alto) return { valor: Math.max(0, (bajo + alto) / 2), ancho: alto - bajo, meseta: meseta?.v ?? null };
  return { valor: Math.max(0, ultimoM.v + 0.5 + ajuste - (ahora - ultimoM.t) / 1000), ancho: 1, meseta: meseta?.v ?? null, inconsistente: true };
}

export const estimarRelojFisico = (muestras, ahora, opciones) => estimarRelojFisicoDetalle(muestras, ahora, opciones).valor;

// Detección automática del tablero: con las palabras que el OCR vio en el
// cuadro COMPLETO (texto + bbox en px) ubica el reloj (el "MM:SS" más
// grande que quepa en un cuarto), los dos puntajes (los dos números más
// grandes de altura parecida, el de la izquierda es el local) y el cuarto
// (un dígito suelto entre ambos). Devuelve { zonaId: {x, y, w, h} } en
// fracción del cuadro; lo que no encuentra, no lo toca.
export function zonasDesdePalabras(palabrasCrudas, ancho, alto, maxSeg = 600) {
  const alturaDe = (p) => p.bbox.y1 - p.bbox.y0;
  const centroX = (p) => (p.bbox.x0 + p.bbox.x1) / 2;
  const centroY = (p) => (p.bbox.y0 + p.bbox.y1) / 2;
  const palabras = palabrasCrudas
    .map((p) => ({ ...p, text: limpiar(p.text).replace(/[^0-9:.]/g, '') }))
    .filter((p) => p.text && alturaDe(p) > 0)
    .sort((a, b) => a.bbox.x0 - b.bbox.x0);
  // Un reloj LED a veces llega partido en "09" y "12" (los dos puntos no se ven).
  const unidas = [];
  for (const p of palabras) {
    const prev = unidas[unidas.length - 1];
    const h = prev && alturaDe(prev);
    if (prev && /^\d{1,2}$/.test(prev.text) && /^\d{2}$/.test(p.text) && Math.abs(alturaDe(p) - h) < h * 0.25
      && Math.abs(centroY(p) - centroY(prev)) < h * 0.4 && p.bbox.x0 - prev.bbox.x1 < h * 0.9) {
      unidas.push({ text: `${prev.text}:${p.text}`, bbox: { x0: prev.bbox.x0, y0: Math.min(prev.bbox.y0, p.bbox.y0), x1: p.bbox.x1, y1: Math.max(prev.bbox.y1, p.bbox.y1) }, partes: [prev, p] });
    }
    unidas.push(p);
  }
  const caja = (b, margen, anchoMinimo = 0) => {
    const h = b.y1 - b.y0;
    const w = Math.max(b.x1 - b.x0, h * anchoMinimo);
    const cx = (b.x0 + b.x1) / 2;
    const x = Math.max(0, (cx - w / 2 - h * margen) / ancho);
    const y = Math.max(0, (b.y0 - h * margen) / alto);
    return { x, y, w: Math.min(1 - x, (w + 2 * h * margen) / ancho), h: Math.min(1 - y, (h * (1 + 2 * margen)) / alto) };
  };
  const res = {};
  const reloj = unidas
    // Para UBICARLO alcanza con que sea un reloj posible, aunque un dígito venga mal leído (89:12).
    .filter((p) => /^\d{1,2}[:.]\d{2}$/.test(p.text) && corregirLectura(p.text, parsearReloj, { posible: (v) => v <= maxSeg }) != null)
    .sort((a, b) => alturaDe(b) - alturaDe(a))[0];
  const usadas = new Set(reloj ? [reloj, ...(reloj.partes || [])] : []);
  // Ancho de sobra: el primer dígito del reloj suele venir recortado en el bbox.
  if (reloj) res.reloj = caja(reloj.bbox, 0.35, 2.9);
  const numeros = palabras.filter((p) => !usadas.has(p) && /^\d{1,3}$/.test(p.text)).sort((a, b) => alturaDe(b) - alturaDe(a));
  for (let i = 0; i < numeros.length && !res.ptsLocal; i++) {
    const a = numeros[i];
    const b = numeros.slice(i + 1).find((n) => Math.abs(alturaDe(n) - alturaDe(a)) <= alturaDe(a) * 0.3 && Math.abs(centroX(n) - centroX(a)) > alturaDe(a) * 1.5);
    if (!b) continue;
    const [local, visita] = [a, b].sort((x, y) => centroX(x) - centroX(y));
    // Lugar para 3 dígitos aunque hoy el puntaje tenga 1 o 2.
    res.ptsLocal = caja(local.bbox, 0.3, 1.9);
    res.ptsVisita = caja(visita.bbox, 0.3, 1.9);
    const periodo = numeros.find((n) => n !== a && n !== b && /^[1-9]$/.test(n.text) && centroX(n) > centroX(local) && centroX(n) < centroX(visita));
    // Si no se vio el cuarto, el lugar típico: entre los dos puntajes.
    const h = alturaDe(local);
    const medio = (centroX(local) + centroX(visita)) / 2;
    res.periodo = periodo ? caja(periodo.bbox, 0.5, 0.9)
      : caja({ x0: medio - h * 0.45, x1: medio + h * 0.45, y0: centroY(local) - h * 0.5, y1: centroY(local) + h * 0.5 }, 0.15);
  }
  return res;
}
