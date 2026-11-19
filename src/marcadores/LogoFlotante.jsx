import { mostrar, estiloTema, idBasePlantilla, familiaDePlantilla } from './utils';
import { coloresPorDefecto } from './coloresPorDefecto';
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
export default function LogoFlotante({ equipoLocal, equipoVisita, config, plantillaId, caja }) {
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
  // Colores reales del tablero elegido (no un negro genérico) y su familia
  // visual, para que la franja/burbuja se lea como parte del mismo diseño.
  const base = coloresPorDefecto(idBasePlantilla(plantillaId));
  const tema = { '--pm-tablero': base.tablero, '--pm-banner': base.banner, ...estiloTema(config) };
  const claseFamilia = `fam-${familiaDePlantilla(plantillaId)}`;
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

  if (posicion === 'costados') {
    if (!caja) return null;

    // Modo 'dentro': media luna que sale del borde izquierdo/derecho real de
    // la caja, como un bulto redondeado del propio marcador, no un círculo
    // aparte flotando al lado. Se probó primero con un medallón REDONDO
    // completo (mismo fondo, tocando el borde) — medido a pixel con
    // Playwright, tocaba perfecto, pero un contorno CERRADO (círculo) al
    // lado de otro contorno cerrado (la caja) siempre se lee como dos
    // objetos separados por más que se toquen. Achicando a la mitad (un
    // "cajón" con esquinas redondeadas solo del lado de AFUERA y sin borde
    // propio del lado que toca la caja) el contorno de la caja se continúa
    // hacia el logo en vez de competir con otro círculo — ahí sí lee como
    // una sola silueta, que es justo lo pedido ("un diseño más continuo").
    if (dentro) {
      // Igual que antes: el alto real de la burbuja sale de una fracción del
      // alto de la caja, en las dos unidades que hacen falta para que sea
      // proporcional sin importar la relación de aspecto del contenedor
      // (`caja.height`, % del ANCHO, para width/padding-*; `caja.heightAlto`,
      // % del ALTO, para top/height — mezclarlas fue el bug real de la ronda
      // anterior de "costados"). El ANCHO visible de la burbuja YA NO es la
      // mitad del alto (un semicírculo angosto dejaba el logo diminuto,
      // exactamente lo que se reportó) — ahora es bien ancho (85% del alto),
      // así el "9999px" de esquinas redondeadas de logoFlotante.css termina
      // recortando algo más parecido a una pastilla/badge que a una media
      // luna finita, con lugar de sobra para un logo de tamaño normal.
      // `logoCostadoTamano` (config, 50-200%) escala esa fracción entera —
      // antes la burbuja no tenía NINGÚN control de tamaño propio.
      // La burbuja mide lo mismo que el alto real del tablero (se lee como
      // parte de la caja) y el escudo hace zoom ADENTRO de ella: agrandarlo
      // nunca agranda la caja ni un solo lado del marcador.
      const zoom = Number.isFinite(config?.logoZoomCaja) ? Math.min(100, Math.max(30, config.logoZoomCaja)) : 80;
      const diametroAlto = caja.heightAlto;
      const anchoBurbuja = caja.height * 0.95;
      const topBurbuja = caja.topAlto;
      const solape = 0.08;
      // Mismo ajuste fino que "arriba"/"abajo" (offsetX/offsetY, ya
      // leídos más arriba) — antes acá no tenían ningún efecto: los
      // sliders se mostraban en el panel pero "costados" los ignoraba
      // del todo. Mismo signo espejado que el resto de los ajustes "un
      // control mueve los dos lados" de la app (ver nominaLogoFondoOffsetX
      // en VistaNomina.jsx): positivo separa cada escudo hacia AFUERA del
      // tablero, negativo lo acerca hacia ADENTRO.
      const burbuja = (equipo, ladoIzquierdo) => {
        if (!equipo?.logo_url) return null;
        const bordeCaja = ladoIzquierdo ? caja.left : caja.left + caja.width;
        const leftBurbuja = ladoIzquierdo ? bordeCaja - anchoBurbuja : bordeCaja - solape;
        const offsetLado = ladoIzquierdo ? -offsetX : offsetX;
        return (
          <div
            className={`lf-burbuja ${ladoIzquierdo ? 'lf-burbuja-izquierda' : 'lf-burbuja-derecha'} ${claseFamilia}`}
            style={{
              position: 'fixed',
              top: `${topBurbuja}%`,
              left: `${leftBurbuja}%`,
              width: `${anchoBurbuja + solape}%`,
              height: `${diametroAlto}%`,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `translate(${offsetLado}px, ${offsetY}px)`,
              ...tema,
            }}
          >
            <img src={equipo.logo_url} alt="" style={{ width: `${zoom}%`, height: `${zoom}%`, objectFit: 'contain', opacity: opacidad }} />
          </div>
        );
      };
      return (
        <>
          {burbuja(equipoLocal, true)}
          {burbuja(equipoVisita, false)}
        </>
      );
    }

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
    transform: `translate(${offsetX}px, ${offsetY}px)`, ...tema,
  };
  return (
    <div className={dentro ? `lf-dentro lf-dentro-${posicion} ${claseFamilia}` : 'lf-fuera'} style={estiloFranja}>
      {img(equipoLocal) || <span />}
      {img(equipoVisita) || <span />}
    </div>
  );
}
