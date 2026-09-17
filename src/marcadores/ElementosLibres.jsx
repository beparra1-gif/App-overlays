import { useRef, useState } from 'react';
import { formatearReloj, etiquetaPeriodo, indicadorFaltas } from './utils';
import './elementosLibres.css';

// "Elementos libres" es el corazón del Creador de marcador (una especie de
// Canva acotado a la caja del marcador, ver CreadorLibre.jsx): cada
// elemento es un dato del partido (nombre, puntos, reloj, período, faltas,
// logo) o un texto/forma libre, con su PROPIA posición (x/y % del lienzo,
// mismo mecanismo que LogosLibres), tipografía, color, ángulo, tamaño y
// animación — sin ningún layout fijo de por medio. El orden en el array ES
// el orden de apilado (el último se dibuja arriba de todos) — "traer al
// frente"/"enviar atrás" en el panel de Disenos.jsx simplemente reordena
// el array, nada de z-index explícito hace falta. No es exclusivo de la
// plantilla "Creador Libre": se dibuja arriba de CUALQUIER plantilla (ver
// VistaMarcador.jsx, junto a LogosLibres) para quien quiera sumarle un
// texto suelto a un diseño ya armado, sin tener que empezar de cero.
//
// `editable` (solo en el panel de "Creador" de Personalizar diseño):
// arrastrar cualquier elemento lo reposiciona en vivo, igual que un logo
// libre — vía Pointer Events, así que funciona igual con mouse, touch (un
// iPad/tablet) o lápiz —, con líneas guía que aparecen y "pegan" el
// arrastre al cruzar el centro del lienzo o la posición de otro elemento —
// mismo espíritu que las guías de alineación de Canva/Figma. Tocar un
// elemento lo selecciona (`onSeleccionar`) para editar su tipografía/
// color/tamaño/ángulo/animación en el panel de al lado. Si tiene `parId`
// (par reflejado Local/Visita, armado desde el panel), Disenos.jsx
// sincroniza al par en espejo — acá no hace falta saberlo, solo reportar
// la posición de ESTE elemento.
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
// esquina, del largo que se le pida a cada una — con un solo vértice
// cortado bien grande ya sale una cinta/paralelogramo tipo "FIBA
// Broadcast"; con las 4 iguales, un octágono parejo. En 0 los 4, es un
// rectángulo común.
function clipPathVertices(tl, tr, br, bl) {
  return `polygon(${tl}px 0, calc(100% - ${tr}px) 0, 100% ${tr}px, 100% calc(100% - ${br}px), calc(100% - ${br}px) 100%, ${bl}px 100%, 0 calc(100% - ${bl}px), 0 ${tl}px)`;
}

// Qué tan cerca (en % del lienzo) hace falta estar de una guía para que el
// arrastre "pegue" ahí — bastante angosto a propósito: tiene que sentirse
// como una ayuda, no como que el elemento no puede quedar donde el dedo/
// mouse lo llevó.
const UMBRAL_GUIA = 1.4;

// El lienzo SIEMPRE es 1920×1080 nativos (ver miniPreview.css) — todas las
// posiciones/tamaños de los elementos libres (xPercent/yPercent, ancho,
// alto, tamano) viven en esa misma escala nativa, sin importar a qué
// tamaño en pantalla termine dibujado el recuadro 16:9. Las manijas de
// selección necesitan ese mismo sistema de referencia para calcular dónde
// dibujarse (ver ManijasElemento).
const LIENZO_ANCHO = 1920;
const LIENZO_ALTO = 1080;

function puntoLocalRotado(lx, ly, cos, sin) {
  return { x: lx * cos - ly * sin, y: lx * sin + ly * cos };
}

// Manijas de selección tipo Canva/Figma: 4 esquinas para redimensionar +
// una manija arriba para rotar libremente, todas ROTADAS junto con el
// elemento (mismo ángulo `rotacion`) para que queden pegadas a las
// esquinas de verdad se vea como se vea el elemento. Se calculan a mano en
// coordenadas nativas del lienzo (no relativas al DOM ya rotado) porque
// así no hace falta tocar el render de cada tipo de elemento (forma/logo/
// texto), que sigue exactamente igual que antes — esto es pura capa
// visual + de arrastre superpuesta.
//
// `w`/`h` son el tamaño (en px nativos) que se usa para UBICAR las
// manijas: el tamaño real (ancho/alto) para forma/imagen, o una
// aproximación para logo/texto (donde el tamaño "real" no es un
// rectángulo fijo de dos ejes independientes) — en esos casos, arrastrar
// CUALQUIER esquina escala de forma proporcional (mismo efecto que mover
// el slider de tamaño), en vez de estirar un eje solo.
function ManijasElemento({ elemento, w, h, escalaLienzo, contenedorRef, onCambiar }) {
  const accionRef = useRef(null);
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
      // Imán suave a los múltiplos de 45° — se siente más prolijo que un
      // ángulo libre exacto, sin impedir un ángulo fino si se lo aleja.
      const cercano45 = Math.round(angulo / 45) * 45;
      if (Math.abs(angulo - cercano45) <= 4) angulo = cercano45 % 360;
      onCambiar({ rotacion: angulo > 180 ? angulo - 360 : angulo });
      return;
    }
    const escala = escalaLienzo || 1;
    const dx = (e.clientX - accion.clientX0) / escala;
    const dy = (e.clientY - accion.clientY0) / escala;
    // Delta del arrastre proyectado sobre los ejes PROPIOS del elemento
    // (rotación inversa) — así arrastrar "hacia afuera" agranda sea cual
    // sea el ángulo al que esté girado el elemento.
    const localDx = dx * cos + dy * sin;
    const localDy = -dx * sin + dy * cos;
    if (esCajaLibre) {
      const nuevoAncho = Math.max(20, Math.round(accion.ancho0 + 2 * accion.sx * localDx));
      const nuevoAlto = Math.max(20, Math.round(accion.alto0 + 2 * accion.sy * localDy));
      onCambiar({ ancho: nuevoAncho, alto: nuevoAlto });
    } else {
      const diagonal0 = Math.hypot(accion.w0, accion.h0) || 1;
      const proyeccion = accion.sx * localDx + accion.sy * localDy;
      const factor = Math.max(0.15, 1 + (2 * proyeccion) / diagonal0);
      if (elemento.tipo === 'logoLocal' || elemento.tipo === 'logoVisita') {
        const cambios = { tamano: Math.max(20, Math.round(accion.tamano0 * factor)) };
        if (accion.alto0 && Number(elemento.alto)) cambios.alto = Math.max(20, Math.round(accion.alto0 * factor));
        onCambiar(cambios);
      } else {
        onCambiar({ tamano: Math.max(8, Math.round(accion.tamano0 * factor)) });
      }
    }
  };
  const alSoltar = () => { accionRef.current = null; };

  // Las manijas viven DENTRO del lienzo escalado (mismo `transform:scale`
  // que todo lo demás, ver miniPreview.css) — sin este contra-escalado
  // `scale(1/escala)`, a un zoom chico (una previa angosta) terminarían
  // dibujándose diminutas, imposibles de tocar con el dedo en una tablet.
  // Con esto, el tamaño EN PANTALLA queda siempre igual (24px), sea cual
  // sea el tamaño real del recuadro 16:9 en ese momento.
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
  // Manija de rotar: a una distancia fija (en pantalla) por encima del
  // borde superior — se convierte esa distancia a px nativos dividiendo
  // por la escala, así se ve siempre igual de lejos sea cual sea el zoom
  // de la vista previa.
  const distanciaRotar = 42 / (escalaLienzo || 1);
  const puntoRotar = puntoLocal(0, -h / 2 - distanciaRotar);
  const puntoBorde = puntoLocal(0, -h / 2);

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
    </>
  );
}

export default function ElementosLibres({ partido, config, editable = false, onArrastrar, onCambiarElemento, onSeleccionar, seleccionadoId, contenedorRef, escalaLienzo = 1 }) {
  const lista = Array.isArray(config?.creadorElementos) ? config.creadorElementos : [];
  const arrastrandoId = useRef(null);
  const [guias, setGuias] = useState({ x: null, y: null });

  if (lista.length === 0) return null;

  const mover = (e) => {
    if (arrastrandoId.current == null || !contenedorRef?.current) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    let xPercent = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    let yPercent = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));

    // Candidatos de guía: el centro del lienzo + la posición de cada OTRO
    // elemento (no el que se está arrastrando) — el primero que quede
    // adentro del umbral gana y "pega" esa coordenada exacta.
    const candidatosX = [50, ...lista.filter((o) => o.id !== arrastrandoId.current).map((o) => o.xPercent ?? 50)];
    const candidatosY = [50, ...lista.filter((o) => o.id !== arrastrandoId.current).map((o) => o.yPercent ?? 50)];
    let guiaX = null;
    let guiaY = null;
    for (const cx of candidatosX) {
      if (Math.abs(xPercent - cx) < UMBRAL_GUIA) { xPercent = cx; guiaX = cx; break; }
    }
    for (const cy of candidatosY) {
      if (Math.abs(yPercent - cy) < UMBRAL_GUIA) { yPercent = cy; guiaY = cy; break; }
    }
    setGuias({ x: guiaX, y: guiaY });
    onArrastrar?.(arrastrandoId.current, xPercent, yPercent);
  };
  const soltar = () => {
    arrastrandoId.current = null;
    setGuias({ x: null, y: null });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: editable ? 'auto' : 'none' }}
      onPointerMove={editable ? mover : undefined}
      onPointerUp={editable ? soltar : undefined}
      onPointerLeave={editable ? soltar : undefined}
    >
      {editable && guias.x != null && (
        <div style={{ position: 'absolute', left: `${guias.x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,45,150,.9)', boxShadow: '0 0 4px rgba(255,45,150,.7)', pointerEvents: 'none' }} />
      )}
      {editable && guias.y != null && (
        <div style={{ position: 'absolute', top: `${guias.y}%`, left: 0, right: 0, height: 1, background: 'rgba(255,45,150,.9)', boxShadow: '0 0 4px rgba(255,45,150,.7)', pointerEvents: 'none' }} />
      )}
      {lista.map((el) => {
        const esLogo = el.tipo === 'logoLocal' || el.tipo === 'logoVisita';
        const equipo = EQUIPO_DEL_TIPO(partido, el.tipo);
        const colorAuto = equipo && el.colorAuto !== false;
        const rotacion = Number(el.rotacion) || 0;
        const opacidadBase = (el.opacidad ?? 100) / 100;
        const estaSeleccionado = editable && seleccionadoId === el.id;
        // Tamaño (px nativos) usado SOLO para ubicar las manijas de
        // selección — el real para forma/imagen (dos ejes independientes),
        // una estimación para logo (con o sin alto propio) y para texto
        // (no tiene un ancho fijo: se aproxima a partir del largo del
        // texto y el tamaño de fuente, nada más para saber dónde dibujar
        // la manija — no afecta el render real del texto).
        let wManija = 200;
        let hManija = 80;
        if (el.tipo === 'forma' || el.tipo === 'imagen') {
          wManija = el.ancho || (el.tipo === 'imagen' ? 220 : 200);
          hManija = el.alto || (el.tipo === 'imagen' ? 220 : 80);
        } else if (esLogo) {
          wManija = el.tamano || 80;
          hManija = el.alto || el.tamano || 80;
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
          pointerEvents: editable ? 'auto' : 'none',
          cursor: editable ? 'grab' : 'default',
          touchAction: editable ? 'none' : 'auto',
          outline: editable && seleccionadoId === el.id ? '2px dashed rgba(10,132,255,.9)' : 'none',
          outlineOffset: 4,
          userSelect: 'none',
        };
        const claseAnimacion = el.animacion && el.animacion !== 'ninguna' ? `elemento-anim-${el.animacion}` : '';
        const handlers = editable ? {
          onPointerDown: (e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            arrastrandoId.current = el.id;
            onSeleccionar?.(el.id);
          },
        } : {};

        const manijas = estaSeleccionado ? (
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
          const usaImagen = Boolean(el.usarImagen && el.imagenUrl);
          const fondo = usaImagen
            ? undefined
            : (el.gradiente
              ? `linear-gradient(${Number(el.gradienteAngulo) || 90}deg, ${el.color || '#0a0c14'}, ${el.color2 || '#4a4a4a'})`
              : (el.color || 'rgba(10,12,20,.85)'));
          const esquinaCortada = el.esquinaModo === 'cortada';
          return (
            <div key={el.id} style={{ display: 'contents' }}>
              <div
                className={claseAnimacion}
                style={{
                  ...posicion,
                  width: `${el.ancho || 200}px`,
                  height: `${el.alto || 80}px`,
                  background: fondo,
                  backgroundImage: usaImagen ? `url(${el.imagenUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRadius: esquinaCortada ? 0 : `${el.radio ?? 12}px`,
                  clipPath: esquinaCortada ? clipPathVertices(el.corteTL || 0, el.corteTR || 0, el.corteBR || 0, el.corteBL || 0) : 'none',
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
        const fondoTexto = el.gradiente
          ? `linear-gradient(${Number(el.gradienteAngulo) || 90}deg, ${el.fondoColor || '#0a0c14'}, ${el.fondoColor2 || '#4a4a4a'})`
          : (el.fondoColor || 'transparent');
        return (
          <div key={el.id} style={{ display: 'contents' }}>
            <span
              className={claseAnimacion}
              style={{
                ...posicion,
                whiteSpace: 'nowrap',
                fontFamily: el.fuente || "'Oswald', sans-serif",
                fontSize: `${el.tamano || 32}px`,
                fontWeight: el.negrita === false ? 500 : 800,
                color: colorTextoFinal,
                background: fondoTexto,
                padding: (el.fondoColor || el.gradiente) ? '4px 14px' : 0,
                borderRadius: (el.fondoColor || el.gradiente) ? '10px' : 0,
                textTransform: el.mayusculas ? 'uppercase' : 'none',
                letterSpacing: el.mayusculas ? '1px' : 'normal',
                textShadow: el.fondoColor ? 'none' : '0 2px 6px rgba(0,0,0,.55)',
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
