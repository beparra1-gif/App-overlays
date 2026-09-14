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

export default function ElementosLibres({ partido, config, editable = false, onArrastrar, onSeleccionar, seleccionadoId, contenedorRef }) {
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

        if (el.tipo === 'forma') {
          const usaImagen = Boolean(el.usarImagen && el.imagenUrl);
          const fondo = usaImagen
            ? undefined
            : (el.gradiente
              ? `linear-gradient(${Number(el.gradienteAngulo) || 90}deg, ${el.color || '#0a0c14'}, ${el.color2 || '#4a4a4a'})`
              : (el.color || 'rgba(10,12,20,.85)'));
          const esquinaCortada = el.esquinaModo === 'cortada';
          return (
            <div
              key={el.id}
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
          );
        }

        if (esLogo) {
          if (!equipo?.logo_url) return null;
          const alto = el.alto;
          const ajuste = el.ajuste || 'contain';
          return (
            <img
              key={el.id}
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
          );
        }

        const texto = el.tipo === 'texto' ? (el.texto || 'Texto libre') : TEXTO_POR_TIPO(partido, config, el.tipo);
        const colorTextoFinal = colorAuto ? equipo.color : (el.color || '#ffffff');
        const fondoTexto = el.gradiente
          ? `linear-gradient(${Number(el.gradienteAngulo) || 90}deg, ${el.fondoColor || '#0a0c14'}, ${el.fondoColor2 || '#4a4a4a'})`
          : (el.fondoColor || 'transparent');
        return (
          <span
            key={el.id}
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
        );
      })}
    </div>
  );
}
