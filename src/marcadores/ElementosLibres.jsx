import { useRef } from 'react';
import { formatearReloj, etiquetaPeriodo, indicadorFaltas } from './utils';

// "Elementos libres" es el corazón del Creador de marcador (una especie de
// Canva acotado a la caja del marcador, ver CreadorLibre.jsx): cada
// elemento es un dato del partido (nombre, puntos, reloj, período, faltas,
// logo) o un texto/forma libre, con su PROPIA posición (x/y % del lienzo,
// mismo mecanismo que LogosLibres), tipografía, color y tamaño — sin
// ninguna caja/layout fijo de por medio. No es exclusivo de la plantilla
// "Creador Libre": se dibuja arriba de CUALQUIER plantilla (ver
// VistaMarcador.jsx, junto a LogosLibres) para quien quiera sumarle un
// texto suelto a un diseño ya armado, sin tener que empezar de cero.
//
// `editable` (solo en el panel de "Creador" de Personalizar diseño):
// arrastrar cualquier elemento lo reposiciona en vivo, igual que un logo
// libre; tocarlo lo selecciona (`onSeleccionar`) para editar su tipografía/
// color/tamaño en el panel de al lado.
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

export default function ElementosLibres({ partido, config, editable = false, onArrastrar, onSeleccionar, seleccionadoId, contenedorRef }) {
  const lista = Array.isArray(config?.creadorElementos) ? config.creadorElementos : [];
  const arrastrandoId = useRef(null);

  if (lista.length === 0) return null;

  const mover = (e) => {
    if (arrastrandoId.current == null || !contenedorRef?.current) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const xPercent = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    onArrastrar?.(arrastrandoId.current, xPercent, yPercent);
  };
  const soltar = () => { arrastrandoId.current = null; };

  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: editable ? 'auto' : 'none' }}
      onPointerMove={editable ? mover : undefined}
      onPointerUp={editable ? soltar : undefined}
      onPointerLeave={editable ? soltar : undefined}
    >
      {lista.map((el) => {
        const esLogo = el.tipo === 'logoLocal' || el.tipo === 'logoVisita';
        const equipo = EQUIPO_DEL_TIPO(partido, el.tipo);
        const colorAuto = equipo && el.colorAuto !== false;
        const posicion = {
          position: 'absolute',
          left: `${Number.isFinite(el.xPercent) ? el.xPercent : 50}%`,
          top: `${Number.isFinite(el.yPercent) ? el.yPercent : 50}%`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: editable ? 'auto' : 'none',
          cursor: editable ? 'grab' : 'default',
          touchAction: editable ? 'none' : 'auto',
          outline: editable && seleccionadoId === el.id ? '2px dashed rgba(10,132,255,.9)' : 'none',
          outlineOffset: 4,
          userSelect: 'none',
        };
        const handlers = editable ? {
          onPointerDown: (e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            arrastrandoId.current = el.id;
            onSeleccionar?.(el.id);
          },
        } : {};

        if (el.tipo === 'forma') {
          return (
            <div
              key={el.id}
              style={{
                ...posicion,
                width: `${el.ancho || 200}px`,
                height: `${el.alto || 80}px`,
                background: el.color || 'rgba(10,12,20,.85)',
                borderRadius: el.formaRedonda ? '999px' : `${el.radio ?? 12}px`,
                opacity: (el.opacidad ?? 100) / 100,
              }}
              {...handlers}
            />
          );
        }

        if (esLogo) {
          if (!equipo?.logo_url) return null;
          return (
            <img
              key={el.id}
              src={equipo.logo_url}
              alt=""
              draggable={false}
              style={{ ...posicion, width: `${el.tamano || 80}px`, height: 'auto', objectFit: 'contain', opacity: (el.opacidad ?? 100) / 100 }}
              {...handlers}
            />
          );
        }

        const texto = el.tipo === 'texto' ? (el.texto || 'Texto libre') : TEXTO_POR_TIPO(partido, config, el.tipo);
        return (
          <span
            key={el.id}
            style={{
              ...posicion,
              whiteSpace: 'nowrap',
              fontFamily: el.fuente || "'Oswald', sans-serif",
              fontSize: `${el.tamano || 32}px`,
              fontWeight: el.negrita === false ? 500 : 800,
              color: colorAuto ? equipo.color : (el.color || '#ffffff'),
              background: el.fondoColor || 'transparent',
              padding: el.fondoColor ? '4px 14px' : 0,
              borderRadius: el.fondoColor ? '10px' : 0,
              textTransform: el.mayusculas ? 'uppercase' : 'none',
              letterSpacing: el.mayusculas ? '1px' : 'normal',
              textShadow: el.fondoColor ? 'none' : '0 2px 6px rgba(0,0,0,.55)',
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
