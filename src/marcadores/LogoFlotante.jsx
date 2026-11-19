import { mostrar } from './utils';
import './logoFlotante.css';

// Logo arriba/abajo/costados del marcador — ancla cerca de la caja y
// muestra los dos escudos. Se renderiza como hermano del marcador (mismo
// truco de apilado position:fixed;inset:0 que el resto de las capas
// compuestas).
//
// Comparte tamaño/transparencia con el logo "dentro" del marcador
// (logoTamanoMarcador/logoOpacidadMarcador): son posiciones alternativas
// del MISMO logo del marcador (elegís una a la vez), no elementos aparte.
//
// `logoCajaModo` decide cómo se ve: 'dentro' (por defecto) lo pinta como una
// franja pegada al borde de la caja, con el mismo color de fondo del
// tablero — para que el marcador se vea "más alto"/"más ancho", no un logo
// flotando aparte; 'fuera' es el comportamiento anterior (flotando cerca,
// sin fondo).
//
// `caja` (ver useCajaMarcador) es la medida REAL de la caja ya renderizada —
// hace falta para "costados" (cada escudo va pegado al borde IZQUIERDO/
// DERECHO real de la caja, no a una aproximación) y también se pasa a
// estiloAnclaLogo/estiloAnclaLogoCaja para "arriba"/"abajo" — mientras no
// llega todavía (primer render), esos dos se sirven con la aproximación de
// siempre así no desaparecen un instante.
export default function LogoFlotante({ equipoLocal, equipoVisita, config, caja }) {
  const posicion = config?.logoPosicion;
  if (!['arriba', 'abajo', 'costados', 'libre'].includes(posicion)) return null;
  if (!mostrar(config, 'mostrarLogo')) return null;

  const opacidadRaw = Number.isFinite(config?.logoOpacidadMarcador) ? config.logoOpacidadMarcador : config?.logoOpacidad;
  const opacidad = Number.isFinite(opacidadRaw) ? opacidadRaw / 100 : 1;
  const tamano = Number(config?.logoTamanoMarcador) || Number(config?.logoTamano) || 40;
  const dentro = (config?.logoCajaModo || 'dentro') !== 'fuera';
  // Ajuste fino (px) para "arriba"/"abajo" flotante: el punto de partida
  // sigue siendo el anclaje automático relativo a la caja (útil de
  // entrada, se acomoda solo si después movés el marcador), pero antes no
  // había forma de correrlo un poco a mano — quedaba SIEMPRE clavado ahí.
  // Con esto el usuario lo nudgea con los sliders y el logo se queda
  // exactamente en ese lugar (el offset se guarda en el diseño, no se
  // recalcula solo).
  const offsetX = Number(config?.logoFlotanteOffsetX) || 0;
  const offsetY = Number(config?.logoFlotanteOffsetY) || 0;
  const img = (equipo, estilo) => equipo?.logo_url && (
    <img src={equipo.logo_url} alt="" style={{ height: tamano, width: 'auto', maxWidth: tamano * 1.8, objectFit: 'contain', opacity: opacidad, ...estilo }} />
  );

  // Posición libre: un punto elegido para el local y el visita va en espejo.
  if (posicion === 'libre') {
    const x = Number.isFinite(config?.logoLibreX) ? config.logoLibreX : 30;
    const y = Number.isFinite(config?.logoLibreY) ? config.logoLibreY : 80;
    const punto = (equipo, left) => equipo?.logo_url && (
      <div style={{ position: 'fixed', left: `${left}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>{img(equipo)}</div>
    );
    return <>{punto(equipoLocal, x)}{punto(equipoVisita, 100 - x)}</>;
  }

  // 'Dentro de la caja' lo dibuja LogoMarcaAgua adentro de la caja real (mismo diseño).
  if (dentro) return null;

  if (posicion === 'costados') {
    if (!caja) return null;
    // Modo 'fuera': el logo flota cerca del borde, sin caja/fondo propio.
    const separacionPx = 14;
    const panelBase = { position: 'fixed', top: `${caja.topAlto}%`, height: `${caja.heightAlto}%`, display: 'flex', alignItems: 'stretch', pointerEvents: 'none' };
    const panel = (equipo, ladoIzquierdo) => {
      if (!equipo?.logo_url) return null;
      const anchoDisponible = ladoIzquierdo ? caja.left : 100 - (caja.left + caja.width);
      const estiloPanel = {
        ...panelBase,
        [ladoIzquierdo ? 'left' : 'right']: 0,
        width: `${Math.max(0, anchoDisponible)}%`,
        justifyContent: ladoIzquierdo ? 'flex-end' : 'flex-start',
        [ladoIzquierdo ? 'paddingRight' : 'paddingLeft']: separacionPx,
      };
      // Mismo ajuste fino que la burbuja de arriba (antes tampoco tenía
      // ningún efecto acá) — positivo separa del tablero, negativo acerca.
      const offsetLado = ladoIzquierdo ? -offsetX : offsetX;
      return (
        <div style={estiloPanel}>
          <div className="lf-costado" style={{ transform: `translate(${offsetLado}px, ${offsetY}px)` }}>
            {/* Antes fijo en 60% de la caja, SIN mirar `tamano` — el
                slider "Tamaño" de arriba lo mostraba en la pantalla de
                edición pero acá no tenía ningún efecto (el bug reportado:
                "agrandar/achicar no hace nada" con el logo afuera de la
                caja). Ahora usa el mismo `tamano` (px) que las demás
                posiciones — un solo control, funciona en todas. */}
            <img src={equipo.logo_url} alt="" style={{ height: tamano, width: 'auto', maxWidth: 'none', objectFit: 'contain', opacity: opacidad }} />
          </div>
        </div>
      );
    };
    return (
      <>
        {panel(equipoLocal, true)}
        {panel(equipoVisita, false)}
      </>
    );
  }

  // Arriba/abajo: cada escudo sobre (o bajo) SU equipo — local a la
  // izquierda, visita a la derecha — con el mismo ancho real de la caja.
  // 'dentro' lo pinta como una franja del propio tablero; 'fuera', solos.
  if (!caja) return null;
  const arriba = posicion === 'arriba';
  const estiloFranja = {
    position: 'fixed', left: `${caja.left}%`, width: `${caja.width}%`,
    ...(arriba ? { bottom: `${100 - caja.topAlto}%` } : { top: `${caja.topAlto + caja.heightAlto}%` }),
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none', boxSizing: 'border-box',
    transform: `translate(${offsetX}px, ${offsetY}px)`,
  };
  return (
    <div className="lf-fuera" style={estiloFranja}>
      {img(equipoLocal) || <span />}
      {img(equipoVisita) || <span />}
    </div>
  );
}
