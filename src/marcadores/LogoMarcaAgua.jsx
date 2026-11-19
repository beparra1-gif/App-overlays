import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { mostrar, piezasDeCaja, elementosDeNombres } from './utils';
import './logoFlotante.css';

// Escudos y nombres DENTRO de la caja real del tablero (portal): así llevan
// exactamente el mismo diseño (fondo, borde, textura, sombra, inclinación),
// porque son parte de la misma caja.
// - Escudos 'fondo': posición libre con zoom, detrás de números y textos,
//   recortados por el borde (agrandarlos nunca agranda la caja).
// - Escudos 'arriba' / 'abajo' / 'costados' (logoCajaModo 'dentro') y
//   nombres 'arriba' / 'abajo' (nombrePosicion): la caja crece lo justo
//   (padding) y cada uno va sobre/bajo/al lado de SU equipo. Si la caja no
//   tiene fondo propio (paneles de color por equipo), crece el panel de cada
//   equipo y el escudo/nombre va en el suyo.
const ENCAJADOS = ['arriba', 'abajo', 'costados'];
const MARGEN_PX = 8;
const PROPS_TEXTO = ['fontFamily', 'fontWeight', 'fontSize', 'fontStyle', 'letterSpacing', 'textTransform', 'textShadow'];

// El elemento de texto que es el nombre de cada equipo (o null).
const nombresEnCaja = (caja, nombres) => elementosDeNombres(caja, nombres).map((lista) => lista[0] || null);

// Centro horizontal (% de la caja) de cada elemento; si falta, los cuartos.
function centros(caja, elementos) {
  const r = caja.getBoundingClientRect();
  return elementos.map((el, i) => {
    if (!el || !r.width || el.offsetParent === null) return i === 0 ? 25 : 75;
    const e = el.getBoundingClientRect();
    return ((e.left + e.width / 2 - r.left) / r.width) * 100;
  });
}

export default function LogoMarcaAgua({ equipoLocal, equipoVisita, config, caja = null }) {
  const posLogo = config?.logoPosicion;
  const logosVisibles = mostrar(config, 'mostrarLogo');
  const logoLado = logosVisibles && ENCAJADOS.includes(posLogo) && (config?.logoCajaModo || 'dentro') === 'dentro' ? posLogo : null;
  const fondo = logosVisibles && posLogo === 'fondo';
  const nombreLado = ['arriba', 'abajo'].includes(config?.nombrePosicion) ? config.nombrePosicion : null;
  const elemento = (logoLado || fondo || nombreLado) ? caja?.elemento : null;
  const tamano = Number(config?.logoTamanoMarcador) || Number(config?.logoTamano) || 40;
  const nombreLocal = equipoLocal?.nombre;
  const nombreVisita = equipoVisita?.nombre;
  const [plan, setPlan] = useState(null);

  useLayoutEffect(() => {
    if (!elemento) return undefined;
    const restaurar = [];
    const guardar = (el, props) => restaurar.push([el, Object.fromEntries(props.map((p) => [p, el.style[p]]))]);
    const preparar = (el) => {
      guardar(el, ['position', 'isolation']);
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.style.isolation = 'isolate';
    };

    // Nombres: misma letra y color que en el diseño; el original se oculta.
    const elsNombre = nombresEnCaja(elemento, [nombreLocal, nombreVisita]);
    let textoNombre = null;
    let coloresNombre = [null, null];
    let altoNombre = 0;
    if (nombreLado) {
      const ref = elsNombre[0] || elsNombre[1];
      const cs = getComputedStyle(ref || elemento);
      textoNombre = Object.fromEntries(PROPS_TEXTO.map((p) => [p, cs[p]]));
      coloresNombre = elsNombre.map((el) => (el ? getComputedStyle(el).color : cs.color));
      altoNombre = parseFloat(cs.fontSize) * 1.25;
    }

    // Cuánto crece cada lado (escudos y nombres se apilan si van al mismo).
    const lados = {};
    if (logoLado) lados[logoLado] = (lados[logoLado] || 0) + tamano + MARGEN_PX * 2;
    if (nombreLado) lados[nombreLado] = (lados[nombreLado] || 0) + altoNombre + MARGEN_PX;
    const pz = Object.keys(lados).length ? piezasDeCaja(elemento) : null;
    const destinos = [];
    for (const [lado, extra] of Object.entries(lados)) {
      const lista = [];
      if (!pz || pz.propia) {
        lista.push({ el: elemento, local: true, visita: true, padding: lado === 'costados' ? ['paddingLeft', 'paddingRight'] : [lado === 'arriba' ? 'paddingTop' : 'paddingBottom'] });
      } else if (lado === 'costados') {
        const mismo = pz.izquierdaEl === pz.derechaEl;
        lista.push({ el: pz.izquierdaEl, local: true, visita: mismo, padding: mismo ? ['paddingLeft', 'paddingRight'] : ['paddingLeft'] });
        if (!mismo) lista.push({ el: pz.derechaEl, local: false, visita: true, padding: ['paddingRight'] });
      } else {
        // Crecen TODAS las piezas por igual (la fila sigue pareja).
        const p = lado === 'arriba' ? 'paddingTop' : 'paddingBottom';
        // El panel de cada equipo puede estar ADENTRO de una pieza más grande (p. ej. Halo Digital).
        for (const el of pz.grandesEl) lista.push({ el, local: el.contains(pz.izquierdaEl), visita: el.contains(pz.derechaEl), padding: [p] });
      }
      for (const d of lista) {
        preparar(d.el);
        guardar(d.el, [...d.padding, 'height', 'width']);
        const cs = getComputedStyle(d.el);
        const antes = { alto: d.el.offsetHeight, ancho: d.el.offsetWidth };
        for (const p of d.padding) d.el.style[p] = `${(parseFloat(cs[p]) || 0) + extra}px`;
        // Pieza con medida fija (border-box): crece también, si no el contenido queda cortado (p. ej. las alas de Trapecio).
        if (cs.boxSizing === 'border-box') {
          if (d.padding.some((p) => p === 'paddingTop' || p === 'paddingBottom')) d.el.style.height = `${antes.alto + extra}px`;
          if (d.padding.some((p) => p === 'paddingLeft' || p === 'paddingRight')) d.el.style.width = `${antes.ancho + extra * d.padding.filter((p) => p === 'paddingLeft' || p === 'paddingRight').length}px`;
        }
        destinos.push({ ...d, lado });
      }
      // Si la FILA que contiene las piezas tiene alto fijo (p. ej. .sxw-fila
      // de Alas en Trapecio), crece lo mismo: si no, las piezas no pueden
      // agrandarse y el puntaje queda cortado.
      if (lado !== 'costados') {
        const filas = new Set(lista.map((d) => d.el.parentElement).filter((f) => f && f !== elemento.parentElement && elemento.contains(f)));
        for (const fila of filas) {
          if (fila.scrollHeight <= fila.clientHeight + 1 && lista.every((d) => d.el.parentElement !== fila || d.el.scrollHeight <= d.el.clientHeight + 1)) continue;
          guardar(fila, ['height']);
          fila.style.height = `${fila.offsetHeight + extra}px`;
        }
      }
    }
    if (fondo) { preparar(elemento); destinos.push({ el: elemento, lado: 'fondo', local: true, visita: true }); }

    // Con la caja ya agrandada: dónde está cada equipo, y recién ahí se saca el nombre de su lugar original.
    let x = centros(elemento, elsNombre);
    // En columna (nombre sobre el puntaje) se oculta conservando su ANCHO
    // (solo colapsa el alto): el tablero no se angosta. En fila (nombre al
    // lado del puntaje, p. ej. Lower Third) se saca del todo para no dejar
    // un hueco, y cada nombre se centra sobre el elemento que quedó a su lado.
    const colapsar = ['visibility', 'height', 'minHeight', 'lineHeight', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'overflow', 'display'];
    if (nombreLado) {
      const enFila = elsNombre.some((el) => el && getComputedStyle(el.parentElement).flexDirection.startsWith('row') && getComputedStyle(el.parentElement).display.includes('flex'));
      elsNombre.forEach((el) => {
        if (!el) return;
        guardar(el, colapsar);
        if (enFila) el.style.display = 'none';
        else Object.assign(el.style, { visibility: 'hidden', height: '0px', minHeight: '0px', lineHeight: '0', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px', overflow: 'hidden' });
      });
      if (enFila) {
        const vecino = (el, local) => {
          if (!el) return null;
          let v = local ? el.nextElementSibling : el.previousElementSibling;
          while (v && v.offsetParent === null) v = local ? v.nextElementSibling : v.previousElementSibling;
          return v || (local ? el.previousElementSibling : el.nextElementSibling);
        };
        x = centros(elemento, [vecino(elsNombre[0], true), vecino(elsNombre[1], false)]);
      }
    }
    setPlan({ destinos, x, textoNombre, coloresNombre });
    return () => { restaurar.reverse().forEach(([el, previo]) => Object.assign(el.style, previo)); };
  }, [elemento, logoLado, fondo, nombreLado, tamano, nombreLocal, nombreVisita, config?.tamanoTextoNombre, config?.fuenteMarcador]);

  if (!elemento || !plan) return null;
  const opacidadRaw = Number.isFinite(config?.logoOpacidadMarcador) ? config.logoOpacidadMarcador : config?.logoOpacidad;
  const opacidadEncajado = Number.isFinite(opacidadRaw) ? opacidadRaw / 100 : 1;
  const img = (equipo, estilo, opacidad = opacidadEncajado) => equipo?.logo_url && (
    <img src={equipo.logo_url} alt="" style={{ position: 'absolute', height: tamano, width: 'auto', maxWidth: tamano * 1.6, objectFit: 'contain', opacity: opacidad, ...estilo }} />
  );
  const nombre = (texto, color, estilo) => texto && (
    <span style={{ position: 'absolute', ...plan.textoNombre, color, whiteSpace: 'nowrap', maxWidth: '48%', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, ...estilo }}>{texto}</span>
  );

  return plan.destinos.filter((d) => d.local || d.visita).map(({ el, lado, local, visita }, i) => {
    let hijos;
    if (lado === 'fondo') {
      const fx = Number.isFinite(config?.logoFondoX) ? config.logoFondoX : 22;
      const fy = Number.isFinite(config?.logoFondoY) ? config.logoFondoY : 50;
      const zoom = Number.isFinite(config?.logoFondoZoom) ? config.logoFondoZoom : 120;
      const op = Number.isFinite(opacidadRaw) ? opacidadRaw / 100 : 0.35;
      const enFondo = (equipo, left) => img(equipo, { left: `${left}%`, top: `${fy}%`, height: `${zoom}%`, maxWidth: 'none', transform: 'translate(-50%, -50%)' }, op);
      // Si la caja no tiene fondo propio (paneles de color), detrás no se vería: va encima, translúcido.
      return createPortal(<div className="lma-capa" style={{ zIndex: caja?.fondoPropio ? -1 : 1 }} aria-hidden>{enFondo(equipoLocal, fx)}{enFondo(equipoVisita, 100 - fx)}</div>, el, `lma-${i}`);
    }
    if (lado === 'costados') {
      const medio = { top: '50%', transform: 'translateY(-50%)' };
      hijos = <>{local && img(equipoLocal, { ...medio, left: MARGEN_PX })}{visita && img(equipoVisita, { ...medio, right: MARGEN_PX })}</>;
    } else {
      // En la caja: sobre cada equipo. En el panel propio de un equipo: centrado en él.
      const x = (cual) => (el === elemento && local && visita ? `${plan.x[cual]}%` : '50%');
      const borde = lado === 'arriba' ? 'top' : 'bottom';
      // El escudo va pegado al borde; el nombre, entre el escudo y el marcador.
      const conLogo = logoLado === lado;
      const pos = (base) => ({ [borde]: base, left: undefined, transform: 'translateX(-50%)' });
      const posNombre = conLogo ? tamano + MARGEN_PX * 2 : MARGEN_PX / 2;
      hijos = (
        <>
          {conLogo && local && img(equipoLocal, { ...pos(MARGEN_PX), left: x(0) })}
          {conLogo && visita && img(equipoVisita, { ...pos(MARGEN_PX), left: x(1) })}
          {nombreLado === lado && local && nombre(nombreLocal, plan.coloresNombre[0], { ...pos(posNombre), left: x(0) })}
          {nombreLado === lado && visita && nombre(nombreVisita, plan.coloresNombre[1], { ...pos(posNombre), left: x(1) })}
        </>
      );
    }
    return createPortal(<div className="lma-capa lma-encajado" aria-hidden>{hijos}</div>, el, `lma-${i}`);
  });
}
