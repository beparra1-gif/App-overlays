import { useRef, useState } from 'react';
import { formatearReloj, etiquetaPeriodo, indicadorFaltas } from './utils';
import { IconoSvg } from './iconosLibres';
import './elementosLibres.css';

// "Elementos libres" es el corazón del Creador de marcador (una especie de
// Canva acotado a la caja del marcador, ver CreadorLibre.jsx): cada
// elemento es un dato del partido (nombre, puntos, reloj, período, faltas,
// logo) o un texto/forma/imagen libre, con su PROPIA posición (x/y % del
// lienzo, mismo mecanismo que LogosLibres), tipografía, color, ángulo,
// tamaño y animación — sin ningún layout fijo de por medio. El orden en el
// array ES el orden de apilado (el último se dibuja arriba de todos).
//
// `editable` (solo en el panel de "Creador"): arrastrar cualquier elemento
// lo reposiciona en vivo — vía Pointer Events, así que funciona igual con
// mouse, touch (un iPad/tablet) o lápiz —, con líneas guía (+ grilla
// opcional) que "pegan" el arrastre. Tocar un elemento lo selecciona
// (`onSeleccionar(id, { extender })` — `extender` true en shift+click,
// suma/saca de la selección en vez de reemplazarla) para editar sus
// propiedades en el panel de al lado. Con más de un elemento seleccionado,
// arrastrar cualquiera de ellos mueve a TODOS juntos (ver `onArrastrar` en
// Disenos.jsx) — redimensionar/rotar con manijas sigue siendo de a uno
// (no hay "redimensionar un grupo" en esta versión).
const TEXTO_POR_TIPO = (partido, config, tipo) => {
  switch (tipo) {
    case 'nombreLocal': return partido.equipoLocal.nombre;
    case 'nombreVisita': return partido.equipoVisita.nombre;
    case 'ptsLocal': return String(partido.ptsLocal ?? 0);
    case 'ptsVisita': return String(partido.ptsVisita ?? 0);
    case 'reloj': return formatearReloj(partido.relojSegundos);
    case 'periodo': return etiquetaPeriodo(partido.periodo);
    case 'faltasLocal': return `F ${indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}`;
    case 'faltasVisita': return `F ${indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}`;
    default: return '';
  }
};

const EQUIPO_DEL_TIPO = (partido, tipo) => {
  if (tipo === 'logoLocal' || tipo === 'nombreLocal' || tipo === 'ptsLocal' || tipo === 'faltasLocal') return partido.equipoLocal;
  if (tipo === 'logoVisita' || tipo === 'nombreVisita' || tipo === 'ptsVisita' || tipo === 'faltasVisita') return partido.equipoVisita;
  return null;
};

// Recorte de esquinas independiente por vértice (top-left/top-right/
// bottom-right/bottom-left, en px) — a diferencia de un border-radius
// (curva pareja), esto arma un octágono con un corte RECTO en cada
// esquina, del largo que se le pida a cada una.
function clipPathVertices(tl, tr, br, bl) {
  return `polygon(${tl}px 0, calc(100% - ${tr}px) 0, 100% ${tr}px, 100% calc(100% - ${br}px), calc(100% - ${br}px) 100%, ${bl}px 100%, 0 calc(100% - ${bl}px), 0 ${tl}px)`;
}

// Relleno de color/degradado compartido por "forma" (color/color2/color3)
// y el fondo de "texto" (fondoColor/fondoColor2/fondoColor3) — lineal (con
// ángulo) o radial, de 2 o 3 colores. Sin degradado, es directamente el
// primer color.
function construirFondo({ gradiente, tipo, angulo, c1, c2, c3 }) {
  if (!gradiente) return c1;
  const colores = c3 ? `${c1}, ${c2}, ${c3}` : `${c1}, ${c2}`;
  if (tipo === 'radial') return `radial-gradient(circle, ${colores})`;
  return `linear-gradient(${Number(angulo) || 90}deg, ${colores})`;
}

// Formas prediseñadas (elemento "forma", campo `formaId`) — más allá del
// rectángulo de siempre (que ya tiene su propio sistema de redondeo/corte
// por vértice, ver clipPathVertices). "círculo" usa border-radius:50% en
// vez de clip-path (así una forma NO cuadrada da una elipse, no un
// círculo recortado raro); el resto son polígonos fijos — no editables
// vértice por vértice como el rectángulo cortado, pero cubren las formas
// más pedidas en un editor tipo Canva sin la complejidad de un editor de
// puntos libre.
export const CATALOGO_FORMAS = [
  { id: 'rectangulo', etiqueta: 'Rectángulo' },
  { id: 'circulo', etiqueta: 'Círculo / óvalo' },
  { id: 'diamante', etiqueta: 'Diamante' },
  { id: 'hexagono', etiqueta: 'Hexágono' },
  { id: 'pentagono', etiqueta: 'Pentágono' },
  { id: 'estrella', etiqueta: 'Estrella' },
  { id: 'flecha', etiqueta: 'Flecha' },
  { id: 'cinta', etiqueta: 'Cinta / banner' },
];

const FORMA_CLIP_PATHS = {
  diamante: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  hexagono: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  pentagono: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  estrella: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  flecha: 'polygon(0% 25%, 60% 25%, 60% 0%, 100% 50%, 60% 100%, 60% 75%, 0% 75%)',
  cinta: 'polygon(0% 0%, 100% 0%, 100% 85%, 50% 100%, 0% 85%)',
};

export function clipPathDeForma(formaId) {
  return FORMA_CLIP_PATHS[formaId] || null;
}

// Qué tan cerca (en % del lienzo) hace falta estar de una guía para que el
// arrastre "pegue" ahí — bastante angosto a propósito: tiene que sentirse
// como una ayuda, no como que el elemento no puede quedar donde el dedo/
// mouse lo llevó.
const UMBRAL_GUIA = 1.4;

// Puntos de grilla (10%, 20%... 90%) usados como candidatos de guía extra
// cuando la grilla visual está prendida — mismo umbral de "pegado" que el
// resto de las guías.
const PUNTOS_GRILLA = [10, 20, 30, 40, 50, 60, 70, 80, 90];

// El lienzo SIEMPRE es 1920×1080 nativos (ver miniPreview.css) — todas las
// posiciones/tamaños de los elementos libres viven en esa misma escala
// nativa, sin importar a qué tamaño en pantalla termine dibujado el
// recuadro 16:9 (ni si además hay zoom de edición encima — `escalaLienzo`
// ya viene MULTIPLICADA por el zoom desde PreviaCombinada, así que toda la
// matemática de acá abajo es ciega a si hay zoom o no).
const LIENZO_ANCHO = 1920;
const LIENZO_ALTO = 1080;

function puntoLocalRotado(lx, ly, cos, sin) {
  return { x: lx * cos - ly * sin, y: lx * sin + ly * cos };
}

// Manijas de selección tipo Canva/Figma: 4 esquinas para redimensionar +
// una manija arriba para rotar libremente, todas ROTADAS junto con el
// elemento. Mientras se arrastra una, se muestra un cartelito con la
// medida en vivo (WxH o el ángulo) — igual que Figma — así no hace falta
// soltar para saber a qué valor exacto se llegó.
function ManijasElemento({ elemento, w, h, escalaLienzo, contenedorRef, onCambiar }) {
  const accionRef = useRef(null);
  const [medicion, setMedicion] = useState(null);
  const rotacion = Number(elemento.rotacion) || 0;
  const theta = (rotacion * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const cx = ((elemento.xPercent ?? 50) / 100) * LIENZO_ANCHO;
  const cy = ((elemento.yPercent ?? 50) / 100) * LIENZO_ALTO;
  const esCajaLibre = elemento.tipo === 'forma' || elemento.tipo === 'imagen';

  const puntoLocal = (lx, ly) => {
    const { x, y } = puntoLocalRotado(lx, ly, cos, sin);
    return { left: `${((cx + x) / LIENZO_ANCHO) * 100}%`, top: `${((cy + y) / LIENZO_ALTO) * 100}%` };
  };

  const empezarResize = (sx, sy) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    accionRef.current = {
      tipo: 'resize', sx, sy,
      clientX0: e.clientX, clientY0: e.clientY,
      w0: w, h0: h,
      ancho0: Number(elemento.ancho) || w,
      alto0: Number(elemento.alto) || h,
      tamano0: Number(elemento.tamano) || w,
    };
  };
  const empezarRotar = (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    accionRef.current = { tipo: 'rotar' };
  };
  const alMover = (e) => {
    const accion = accionRef.current;
    if (!accion || !contenedorRef?.current) return;
    if (accion.tipo === 'rotar') {
      const rect = contenedorRef.current.getBoundingClientRect();
      const centroX = rect.left + ((elemento.xPercent ?? 50) / 100) * rect.width;
      const centroY = rect.top + ((elemento.yPercent ?? 50) / 100) * rect.height;
      let angulo = (Math.atan2(e.clientY - centroY, e.clientX - centroX) * 180) / Math.PI + 90;
      angulo = ((Math.round(angulo) % 360) + 360) % 360;
      const cercano45 = Math.round(angulo / 45) * 45;
      if (Math.abs(angulo - cercano45) <= 4) angulo = cercano45 % 360;
      const final = angulo > 180 ? angulo - 360 : angulo;
      setMedicion(`${final}°`);
      onCambiar({ rotacion: final });
      return;
    }
    const escala = escalaLienzo || 1;
    const dx = (e.clientX - accion.clientX0) / escala;
    const dy = (e.clientY - accion.clientY0) / escala;
    const localDx = dx * cos + dy * sin;
    const localDy = -dx * sin + dy * cos;
    if (esCajaLibre && !elemento.proporcionFija) {
      const nuevoAncho = Math.max(20, Math.round(accion.ancho0 + 2 * accion.sx * localDx));
      const nuevoAlto = Math.max(20, Math.round(accion.alto0 + 2 * accion.sy * localDy));
      setMedicion(`${nuevoAncho}×${nuevoAlto}px`);
      onCambiar({ ancho: nuevoAncho, alto: nuevoAlto });
    } else if (esCajaLibre && elemento.proporcionFija) {
      // "Mantener proporción": los dos ejes escalan juntos por el mismo
      // factor (mismo cálculo que logo/texto más abajo), en vez de
      // estirar cada eje por separado.
      const diagonal0 = Math.hypot(accion.w0, accion.h0) || 1;
      const proyeccion = accion.sx * localDx + accion.sy * localDy;
      const factor = Math.max(0.15, 1 + (2 * proyeccion) / diagonal0);
      const nuevoAncho = Math.max(20, Math.round(accion.ancho0 * factor));
      const nuevoAlto = Math.max(20, Math.round(accion.alto0 * factor));
      setMedicion(`${nuevoAncho}×${nuevoAlto}px`);
      onCambiar({ ancho: nuevoAncho, alto: nuevoAlto });
    } else {
      const diagonal0 = Math.hypot(accion.w0, accion.h0) || 1;
      const proyeccion = accion.sx * localDx + accion.sy * localDy;
      const factor = Math.max(0.15, 1 + (2 * proyeccion) / diagonal0);
      if (elemento.tipo === 'logoLocal' || elemento.tipo === 'logoVisita') {
        const nuevoTamano = Math.max(20, Math.round(accion.tamano0 * factor));
        const cambios = { tamano: nuevoTamano };
        if (accion.alto0 && Number(elemento.alto)) cambios.alto = Math.max(20, Math.round(accion.alto0 * factor));
        setMedicion(`${nuevoTamano}px`);
        onCambiar(cambios);
      } else {
        const nuevoTamano = Math.max(8, Math.round(accion.tamano0 * factor));
        setMedicion(`${nuevoTamano}px`);
        onCambiar({ tamano: nuevoTamano });
      }
    }
  };
  const alSoltar = () => { accionRef.current = null; setMedicion(null); };

  // Las manijas viven DENTRO del lienzo escalado (mismo `transform:scale`
  // que todo lo demás, ver miniPreview.css) — sin este contra-escalado
  // `scale(1/escala)`, a un zoom chico (una previa angosta) terminarían
  // dibujándose diminutas, imposibles de tocar con el dedo en una tablet.
  // Con esto, el tamaño EN PANTALLA queda siempre igual (24px), sea cual
  // sea el tamaño real del recuadro 16:9 en ese momento (zoom de edición
  // incluido, ya que `escalaLienzo` acá viene multiplicado por el zoom).
  const escalaInversa = 1 / (escalaLienzo || 1);
  const estiloManija = (cursor) => ({
    position: 'absolute',
    width: 24,
    height: 24,
    transform: `translate(-50%, -50%) scale(${escalaInversa})`,
    background: '#0a84ff',
    border: '3px solid #fff',
    borderRadius: 6,
    boxShadow: '0 1px 5px rgba(0,0,0,.55)',
    cursor,
    pointerEvents: 'auto',
    touchAction: 'none',
    zIndex: 5,
  });

  const esquinas = [
    { sx: -1, sy: -1, cursor: 'nwse-resize' },
    { sx: 1, sy: -1, cursor: 'nesw-resize' },
    { sx: 1, sy: 1, cursor: 'nwse-resize' },
    { sx: -1, sy: 1, cursor: 'nesw-resize' },
  ];
  const distanciaRotar = 42 / (escalaLienzo || 1);
  const puntoRotar = puntoLocal(0, -h / 2 - distanciaRotar);
  const puntoBorde = puntoLocal(0, -h / 2);
  const puntoMedicion = puntoLocal(0, -h / 2 - distanciaRotar - 30 / (escalaLienzo || 1));

  return (
    <>
      {esquinas.map(({ sx, sy, cursor }) => (
        <div
          key={`${sx}-${sy}`}
          style={{ ...estiloManija(cursor), ...puntoLocal(sx * w / 2, sy * h / 2) }}
          onPointerDown={empezarResize(sx, sy)}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          width: 2 * escalaInversa,
          background: 'rgba(10,132,255,.85)',
          transformOrigin: 'top center',
          ...puntoBorde,
          height: `${distanciaRotar}px`,
          transform: `translate(-50%, 0) rotate(${rotacion}deg)`,
          pointerEvents: 'none',
        }}
      />
      <div
        title="Arrastrar para rotar"
        style={{ ...estiloManija('grab'), ...puntoRotar, borderRadius: '50%', background: '#0a84ff' }}
        onPointerDown={empezarRotar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      />
      {medicion && (
        <div
          style={{
            position: 'absolute',
            ...puntoMedicion,
            transform: `translate(-50%, -50%) scale(${escalaInversa})`,
            background: 'rgba(10,10,14,.92)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 6,
          }}
        >
          {medicion}
        </div>
      )}
    </>
  );
}

export default function ElementosLibres({
  partido, config, editable = false,
  onArrastrar, onCambiarElemento, onSeleccionar,
  seleccionadosIds = [], contenedorRef, escalaLienzo = 1,
  modoPan = false, onPanear,
  mostrarGrilla = false, mostrarMargenSeguro = false,
}) {
  const lista = Array.isArray(config?.creadorElementos) ? config.creadorElementos : [];
  const arrastrandoId = useRef(null);
  const panRef = useRef(null);
  const [guias, setGuias] = useState({ x: null, y: null });
  const [medicionMovimiento, setMedicionMovimiento] = useState(null);

  if (lista.length === 0 && !mostrarGrilla && !mostrarMargenSeguro) return null;

  const mover = (e) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x0;
      const dy = e.clientY - panRef.current.y0;
      panRef.current = { x0: e.clientX, y0: e.clientY };
      onPanear?.(dx, dy);
      return;
    }
    if (arrastrandoId.current == null || !contenedorRef?.current) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    let xPercent = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    let yPercent = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));

    // Candidatos de guía: el centro del lienzo + la grilla (si está
    // prendida) + la posición de cada OTRO elemento — el primero que
    // quede adentro del umbral gana y "pega" esa coordenada exacta.
    const candidatosX = [50, ...(mostrarGrilla ? PUNTOS_GRILLA : []), ...lista.filter((o) => o.id !== arrastrandoId.current).map((o) => o.xPercent ?? 50)];
    const candidatosY = [50, ...(mostrarGrilla ? PUNTOS_GRILLA : []), ...lista.filter((o) => o.id !== arrastrandoId.current).map((o) => o.yPercent ?? 50)];
    let guiaX = null;
    let guiaY = null;
    for (const cx of candidatosX) {
      if (Math.abs(xPercent - cx) < UMBRAL_GUIA) { xPercent = cx; guiaX = cx; break; }
    }
    for (const cy of candidatosY) {
      if (Math.abs(yPercent - cy) < UMBRAL_GUIA) { yPercent = cy; guiaY = cy; break; }
    }
    setGuias({ x: guiaX, y: guiaY });
    setMedicionMovimiento(`${Math.round(xPercent)}%, ${Math.round(yPercent)}%`);
    onArrastrar?.(arrastrandoId.current, xPercent, yPercent);
  };
  const soltar = () => {
    panRef.current = null;
    arrastrandoId.current = null;
    setGuias({ x: null, y: null });
    setMedicionMovimiento(null);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: editable ? 'auto' : 'none' }}
      onPointerDown={editable && modoPan ? (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        panRef.current = { x0: e.clientX, y0: e.clientY };
      } : undefined}
      onPointerMove={editable ? mover : undefined}
      onPointerUp={editable ? soltar : undefined}
      onPointerLeave={editable ? soltar : undefined}
    >
      {editable && mostrarMargenSeguro && (
        <div style={{ position: 'absolute', left: '5%', top: '5%', right: '5%', bottom: '5%', border: '1.5px dashed rgba(255,214,10,.65)', pointerEvents: 'none' }} />
      )}
      {editable && mostrarGrilla && PUNTOS_GRILLA.map((p) => (
        <div key={`gx-${p}`} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.14)', pointerEvents: 'none' }} />
      ))}
      {editable && mostrarGrilla && PUNTOS_GRILLA.map((p) => (
        <div key={`gy-${p}`} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.14)', pointerEvents: 'none' }} />
      ))}
      {editable && guias.x != null && (
        <div style={{ position: 'absolute', left: `${guias.x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,45,150,.9)', boxShadow: '0 0 4px rgba(255,45,150,.7)', pointerEvents: 'none' }} />
      )}
      {editable && guias.y != null && (
        <div style={{ position: 'absolute', top: `${guias.y}%`, left: 0, right: 0, height: 1, background: 'rgba(255,45,150,.9)', boxShadow: '0 0 4px rgba(255,45,150,.7)', pointerEvents: 'none' }} />
      )}
      {editable && medicionMovimiento && arrastrandoId.current != null && (() => {
        const el = lista.find((o) => o.id === arrastrandoId.current);
        if (!el) return null;
        return (
          <div
            style={{
              position: 'absolute',
              left: `${el.xPercent ?? 50}%`,
              top: `${el.yPercent ?? 50}%`,
              transform: `translate(12px, 12px) scale(${1 / (escalaLienzo || 1)})`,
              transformOrigin: 'top left',
              background: 'rgba(10,10,14,.92)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 6,
            }}
          >
            {medicionMovimiento}
          </div>
        );
      })()}
      {lista.map((el) => {
        if (el.oculto) return null;
        const esLogo = el.tipo === 'logoLocal' || el.tipo === 'logoVisita';
        const equipo = EQUIPO_DEL_TIPO(partido, el.tipo);
        const colorAuto = equipo && el.colorAuto !== false;
        const rotacion = Number(el.rotacion) || 0;
        const opacidadBase = (el.opacidad ?? 100) / 100;
        const seleccionado = editable && seleccionadosIds.includes(el.id);
        const seleccionUnica = seleccionado && seleccionadosIds.length === 1;
        const interactivo = editable && !modoPan && !el.bloqueado;
        const mezcla = el.mezcla && el.mezcla !== 'normal' ? el.mezcla : undefined;
        // Tamaño (px nativos) usado SOLO para ubicar las manijas de
        // selección — el real para forma/imagen (dos ejes independientes),
        // una estimación para logo/texto (nada más para saber dónde
        // dibujar la manija — no afecta el render real).
        let wManija = 200;
        let hManija = 80;
        if (el.tipo === 'forma' || el.tipo === 'imagen') {
          wManija = el.ancho || (el.tipo === 'imagen' ? 220 : 200);
          hManija = el.alto || (el.tipo === 'imagen' ? 220 : 80);
        } else if (el.tipo === 'icono') {
          wManija = el.tamano || 80;
          hManija = el.tamano || 80;
        } else if (esLogo) {
          wManija = el.tamano || 80;
          hManija = el.alto || el.tamano || 80;
        } else if (el.tipo === 'texto' && el.multilinea) {
          const tam = el.tamano || 32;
          const ancho = el.anchoTexto || 400;
          const caracteresPorLinea = Math.max(4, ancho / (tam * 0.55));
          const lineas = Math.max(1, Math.ceil((el.texto || '').length / caracteresPorLinea));
          wManija = ancho;
          hManija = tam * 1.3 * lineas;
        } else {
          const textoManija = el.tipo === 'texto' ? (el.texto || 'Texto libre') : TEXTO_POR_TIPO(partido, config, el.tipo);
          const tam = el.tamano || 32;
          wManija = Math.max(30, textoManija.length * tam * 0.62);
          hManija = tam * 1.4;
        }
        // `--tf-base` (ver elementosLibres.css): el translate+rotate de
        // siempre, disponible como variable para que las animaciones que
        // SÍ tocan `transform` (pulso/flotar/girar) lo combinen con su
        // propio movimiento en vez de perder el centrado/ángulo elegido.
        const tfBase = `translate(-50%, -50%) rotate(${rotacion}deg)`;
        const posicion = {
          position: 'absolute',
          left: `${Number.isFinite(el.xPercent) ? el.xPercent : 50}%`,
          top: `${Number.isFinite(el.yPercent) ? el.yPercent : 50}%`,
          transform: tfBase,
          '--tf-base': tfBase,
          '--op-base': opacidadBase,
          pointerEvents: interactivo ? 'auto' : 'none',
          cursor: interactivo ? 'grab' : 'default',
          touchAction: interactivo ? 'none' : 'auto',
          outline: seleccionado ? (el.bloqueado ? '2px dashed rgba(255,159,10,.9)' : '2px dashed rgba(10,132,255,.9)') : 'none',
          outlineOffset: 4,
          userSelect: 'none',
          mixBlendMode: mezcla,
        };
        const claseAnimacion = el.animacion && el.animacion !== 'ninguna' ? `elemento-anim-${el.animacion}` : '';
        const handlers = interactivo ? {
          onPointerDown: (e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            arrastrandoId.current = el.id;
            // Si este elemento YA es parte de una selección múltiple, no la
            // tocamos acá — así arrastrar cualquiera de los seleccionados
            // mueve a todo el grupo junto. Si no, se comporta como
            // siempre: reemplaza la selección (o suma/saca con shift).
            const yaEnGrupo = seleccionadosIds.length > 1 && seleccionadosIds.includes(el.id);
            if (!yaEnGrupo) onSeleccionar?.(el.id, { extender: e.shiftKey });
          },
        } : {};

        const manijas = seleccionUnica && !el.bloqueado ? (
          <ManijasElemento
            elemento={el}
            w={wManija}
            h={hManija}
            escalaLienzo={escalaLienzo}
            contenedorRef={contenedorRef}
            onCambiar={(cambios) => onCambiarElemento?.(el.id, cambios)}
          />
        ) : null;

        if (el.tipo === 'forma') {
          // Relleno: color/degradado fijo (de siempre), una imagen SUBIDA
          // fija, o — nuevo — el logo del equipo Local/Visita, en vivo. En
          // el modo "logo del equipo" no hay ninguna URL guardada en el
          // elemento: se lee de `partido` en cada render, así que si el
          // partido cambia de rival el tablero se actualiza solo, en vez
          // de quedar con el logo del primer equipo con el que se armó el
          // diseño (eso era justo el problema del modo "imagen" a secas
          // para este caso de uso).
          const relleno = el.rellenoTipo || (el.usarImagen ? 'imagen' : 'color');
          const equipoDelRelleno = relleno === 'equipoLocal' ? partido?.equipoLocal : relleno === 'equipoVisita' ? partido?.equipoVisita : null;
          const esRellenoLogo = relleno === 'equipoLocal' || relleno === 'equipoVisita';
          const imagenUrlFinal = relleno === 'imagen' ? el.imagenUrl : (equipoDelRelleno?.logo_url || null);
          const usaImagen = Boolean(imagenUrlFinal);
          // Mismo concepto que el "color automático" que ya tenía el
          // texto: si se elige, el COLOR de la forma (base sólida, primer
          // color del degradado, o fondo detrás de un logo) sigue al color
          // real del equipo elegido en vez de un hex fijo — independiente
          // de si el relleno además usa una imagen o no.
          const equipoDelColor = el.colorAuto === 'local' ? partido?.equipoLocal : el.colorAuto === 'visita' ? partido?.equipoVisita : null;
          const colorBase = equipoDelColor?.color || el.color || 'rgba(10,12,20,.85)';
          // `backgroundColor`/`backgroundImage` en vez del shorthand
          // `background` a propósito: React avisa (y con razón — puede
          // dejar un valor viejo pegado) si un re-render mezcla el
          // shorthand con sus propias propiedades largas (backgroundSize/
          // backgroundPosition, acá abajo) para el mismo elemento.
          const fondoImagen = usaImagen
            ? `url(${imagenUrlFinal})`
            : (el.gradiente ? construirFondo({
                gradiente: true, tipo: el.gradienteTipo, angulo: el.gradienteAngulo,
                c1: colorBase, c2: el.color2 || '#4a4a4a', c3: el.color3,
              }) : undefined);
          // Detrás de un logo de equipo (transparente, tipo escudo) sigue
          // sirviendo un color de fondo — arma un "escudo/badge" en vez de
          // dejar ver lo que sea que haya debajo. Una imagen SUBIDA a
          // mano (fotos, texturas) en cambio suele ya cubrir todo el
          // recuadro sola, así que no le agrega ningún fondo.
          const fondoColorSolido = usaImagen
            ? (esRellenoLogo ? colorBase : undefined)
            : (el.gradiente ? undefined : colorBase);
          const formaId = el.formaId || 'rectangulo';
          const esCirculo = formaId === 'circulo';
          const clipForma = clipPathDeForma(formaId);
          const esquinaCortada = formaId === 'rectangulo' && el.esquinaModo === 'cortada';
          return (
            <div key={el.id} style={{ display: 'contents' }}>
              <div
                className={claseAnimacion}
                style={{
                  ...posicion,
                  width: `${el.ancho || 200}px`,
                  height: `${el.alto || 80}px`,
                  backgroundColor: fondoColorSolido,
                  backgroundImage: fondoImagen,
                  backgroundSize: usaImagen ? (esRellenoLogo ? 'contain' : 'cover') : undefined,
                  backgroundPosition: usaImagen ? 'center' : undefined,
                  backgroundRepeat: usaImagen ? 'no-repeat' : undefined,
                  borderRadius: esCirculo ? '50%' : (esquinaCortada || clipForma ? 0 : `${el.radio ?? 12}px`),
                  clipPath: clipForma || (esquinaCortada ? clipPathVertices(el.corteTL || 0, el.corteTR || 0, el.corteBR || 0, el.corteBL || 0) : 'none'),
                  border: el.bordeAncho ? `${el.bordeAncho}px solid ${el.bordeColor || '#ffffff'}` : undefined,
                  boxShadow: el.sombra ? `${el.sombraX ?? 0}px ${el.sombraY ?? 8}px ${el.sombraBlur ?? 20}px 0 ${el.sombraColor || 'rgba(0,0,0,.6)'}` : undefined,
                  opacity: opacidadBase,
                }}
                {...handlers}
              />
              {manijas}
            </div>
          );
        }

        if (el.tipo === 'imagen') {
          if (!el.imagenUrl) return null;
          const ajuste = el.ajuste || 'contain';
          const esquinaCortada = el.esquinaModo === 'cortada';
          return (
            <div key={el.id} style={{ display: 'contents' }}>
              <div
                className={claseAnimacion}
                style={{
                  ...posicion,
                  width: `${el.ancho || 220}px`,
                  height: `${el.alto || 220}px`,
                  borderRadius: esquinaCortada ? 0 : `${el.radio ?? 0}px`,
                  clipPath: esquinaCortada ? clipPathVertices(el.corteTL || 0, el.corteTR || 0, el.corteBR || 0, el.corteBL || 0) : 'none',
                  border: el.bordeAncho ? `${el.bordeAncho}px solid ${el.bordeColor || '#ffffff'}` : undefined,
                  filter: el.sombra ? `drop-shadow(${el.sombraX ?? 0}px ${el.sombraY ?? 8}px ${el.sombraBlur ?? 14}px ${el.sombraColor || 'rgba(0,0,0,.6)'})` : undefined,
                  opacity: opacidadBase,
                  overflow: 'hidden',
                }}
                {...handlers}
              >
                <img src={el.imagenUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: ajuste, pointerEvents: 'none', display: 'block' }} />
              </div>
              {manijas}
            </div>
          );
        }

        if (el.tipo === 'icono') {
          return (
            <div key={el.id} style={{ display: 'contents' }}>
              <div
                className={claseAnimacion}
                style={{
                  ...posicion,
                  width: `${el.tamano || 80}px`,
                  height: `${el.tamano || 80}px`,
                  border: el.bordeAncho ? `${el.bordeAncho}px solid ${el.bordeColor || '#ffffff'}` : undefined,
                  borderRadius: el.radio ? `${el.radio}px` : 0,
                  padding: el.bordeAncho ? '6px' : 0,
                  boxSizing: 'border-box',
                  filter: el.sombra ? `drop-shadow(${el.sombraX ?? 0}px ${el.sombraY ?? 8}px ${el.sombraBlur ?? 14}px ${el.sombraColor || 'rgba(0,0,0,.6)'})` : undefined,
                  opacity: opacidadBase,
                }}
                {...handlers}
              >
                <IconoSvg id={el.iconoId || 'estrella'} color={el.color || '#ffd60a'} />
              </div>
              {manijas}
            </div>
          );
        }

        if (esLogo) {
          if (!equipo?.logo_url) return null;
          const alto = el.alto;
          const ajuste = el.ajuste || 'contain';
          return (
            <div key={el.id} style={{ display: 'contents' }}>
              <img
                className={claseAnimacion}
                src={equipo.logo_url}
                alt=""
                draggable={false}
                style={{
                  ...posicion,
                  width: `${el.tamano || 80}px`,
                  height: alto ? `${alto}px` : 'auto',
                  objectFit: alto ? ajuste : 'contain',
                  borderRadius: el.radio ? `${el.radio}px` : 0,
                  border: el.bordeAncho ? `${el.bordeAncho}px solid ${el.bordeColor || '#ffffff'}` : undefined,
                  filter: el.sombra ? `drop-shadow(${el.sombraX ?? 0}px ${el.sombraY ?? 8}px ${el.sombraBlur ?? 14}px ${el.sombraColor || 'rgba(0,0,0,.6)'})` : undefined,
                  opacity: opacidadBase,
                }}
                {...handlers}
              />
              {manijas}
            </div>
          );
        }

        const texto = el.tipo === 'texto' ? (el.texto || 'Texto libre') : TEXTO_POR_TIPO(partido, config, el.tipo);
        const colorTextoFinal = colorAuto ? equipo.color : (el.color || '#ffffff');
        // `backgroundColor`/`backgroundImage` separados (no el shorthand
        // `background`) por el mismo motivo que en "forma" — ver comentario
        // de más arriba.
        const fondoTextoImagen = (el.fondoColor && el.gradiente) ? construirFondo({
          gradiente: true, tipo: el.gradienteTipo, angulo: el.gradienteAngulo,
          c1: el.fondoColor, c2: el.fondoColor2 || '#4a4a4a', c3: el.fondoColor3,
        }) : undefined;
        const fondoTextoColor = (el.fondoColor && !el.gradiente) ? el.fondoColor : undefined;
        const sombraTexto = el.sombra === false ? 'none' : (el.fondoColor ? 'none' : `${el.sombraX ?? 0}px ${el.sombraY ?? 2}px ${el.sombraBlur ?? 6}px ${el.sombraColor || 'rgba(0,0,0,.55)'}`);
        // "Multilínea" (solo texto libre, no los datos del partido — un
        // nombre de equipo no necesita partirse en varias líneas): en vez
        // de una sola línea que nunca se corta, se le da un ancho fijo y
        // se deja que el texto haga salto de línea natural — el mismo
        // `translate(-50%,-50%)` de siempre sigue centrando el bloque
        // entero en su punto, aunque ahora tenga alto de más de una línea.
        const multilinea = el.tipo === 'texto' && el.multilinea;
        return (
          <div key={el.id} style={{ display: 'contents' }}>
            <span
              className={claseAnimacion}
              style={{
                ...posicion,
                whiteSpace: multilinea ? 'pre-wrap' : 'nowrap',
                width: multilinea ? `${el.anchoTexto || 400}px` : undefined,
                textAlign: multilinea ? (el.alineacion || 'center') : undefined,
                lineHeight: multilinea ? 1.25 : undefined,
                fontFamily: el.fuente || "'Oswald', sans-serif",
                fontSize: `${el.tamano || 32}px`,
                fontWeight: el.negrita === false ? 500 : 800,
                color: colorTextoFinal,
                backgroundColor: fondoTextoColor,
                backgroundImage: fondoTextoImagen,
                padding: (el.fondoColor) ? '4px 14px' : 0,
                borderRadius: (el.fondoColor) ? '10px' : 0,
                textTransform: el.mayusculas ? 'uppercase' : 'none',
                letterSpacing: el.mayusculas ? '1px' : 'normal',
                textShadow: sombraTexto,
                WebkitTextStroke: el.bordeAncho ? `${el.bordeAncho}px ${el.bordeColor || '#000000'}` : undefined,
                opacity: opacidadBase,
              }}
              {...handlers}
            >
              {texto}
            </span>
            {manijas}
          </div>
        );
      })}
    </div>
  );
}
