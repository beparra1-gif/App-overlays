import { mostrar, estiloAnclaLogo, estiloAnclaLogoCaja, estiloTema, fuenteDePlantilla } from './utils';
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
// DERECHO real de la caja, no a una aproximación) y para "arriba"/"abajo" es
// opcional: si no llega todavía (primer render), esos dos siguen sirviéndose
// con la aproximación de siempre así no desaparecen un instante.
export default function LogoFlotante({ equipoLocal, equipoVisita, config, plantillaId, caja }) {
  const posicion = config?.logoPosicion;
  if (posicion !== 'arriba' && posicion !== 'abajo' && posicion !== 'costados') return null;
  if (!mostrar(config, 'mostrarLogo')) return null;

  const opacidadRaw = Number.isFinite(config?.logoOpacidadMarcador) ? config.logoOpacidadMarcador : config?.logoOpacidad;
  const opacidad = Number.isFinite(opacidadRaw) ? opacidadRaw / 100 : 1;
  const tamano = Number(config?.logoTamanoMarcador) || Number(config?.logoTamano) || 40;
  const dentro = (config?.logoCajaModo || 'dentro') !== 'fuera';

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
      const factor = 0.68;
      const diametroAncho = caja.height * factor;
      const diametroAlto = caja.heightAlto * factor;
      const anchoBurbuja = diametroAncho * 0.85;
      const centroVerticalAlto = caja.topAlto + caja.heightAlto / 2;
      const topBurbuja = centroVerticalAlto - diametroAlto / 2;
      // Solape chico hacia ADENTRO de la caja + z-index negativo: sirve de
      // colchón contra cualquier redondeo de sub-píxel en la medición, pero
      // ahora es solo un respaldo (no la clave del diseño, como antes) — el
      // lado que toca la caja ya no tiene borde propio, así que un solape
      // de más o de menos no se nota (no hay una segunda línea de contorno
      // que pueda quedar "doble" ni "cortada").
      const solape = 0.5;
      const burbuja = (equipo, ladoIzquierdo) => {
        if (!equipo?.logo_url) return null;
        const bordeCaja = ladoIzquierdo ? caja.left : caja.left + caja.width;
        const leftBurbuja = ladoIzquierdo ? bordeCaja - anchoBurbuja : bordeCaja - solape;
        return (
          <div
            className={`lf-burbuja ${ladoIzquierdo ? 'lf-burbuja-izquierda' : 'lf-burbuja-derecha'}`}
            style={{
              position: 'fixed',
              top: `${topBurbuja}%`,
              left: `${leftBurbuja}%`,
              width: `${anchoBurbuja + solape}%`,
              height: `${diametroAlto}%`,
              zIndex: -1,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...estiloTema(config),
            }}
          >
            <img src={equipo.logo_url} alt="" style={{ width: '74%', height: '74%', objectFit: 'contain', opacity: opacidad }} />
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

    // Modo 'fuera': el logo flota cerca del borde, sin caja/fondo propio —
    // sin cambios respecto de antes.
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
      return (
        <div style={estiloPanel}>
          <div className="lf-costado">
            <img src={equipo.logo_url} alt="" style={{ height: '60%', width: 'auto', maxWidth: 'none', objectFit: 'contain', opacity: opacidad }} />
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

  if (dentro) {
    const estiloAncla = { position: 'fixed', inset: 0, display: 'flex', pointerEvents: 'none', ...estiloTema(config), '--pm-fuente': fuenteDePlantilla(plantillaId), ...estiloAnclaLogoCaja(config, posicion) };
    return (
      <div style={estiloAncla}>
        <div className={`lf-dentro lf-dentro-${posicion}`}>
          <div className="lf-logos">
            {equipoLocal?.logo_url && (
              <img src={equipoLocal.logo_url} alt="" style={{ height: tamano, width: 'auto', maxWidth: tamano * 1.8, objectFit: 'contain', opacity: opacidad }} />
            )}
            {equipoVisita?.logo_url && (
              <img src={equipoVisita.logo_url} alt="" style={{ height: tamano, width: 'auto', maxWidth: tamano * 1.8, objectFit: 'contain', opacity: opacidad }} />
            )}
          </div>
        </div>
      </div>
    );
  }

  const estiloAncla = estiloAnclaLogo(config, posicion);
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', pointerEvents: 'none', ...estiloAncla }}>
      <div style={{ display: 'flex', gap: 16, transform: 'translateX(-50%)' }}>
        {equipoLocal?.logo_url && (
          <img src={equipoLocal.logo_url} alt="" style={{ height: tamano, width: 'auto', maxWidth: tamano * 1.8, objectFit: 'contain', opacity: opacidad }} />
        )}
        {equipoVisita?.logo_url && (
          <img src={equipoVisita.logo_url} alt="" style={{ height: tamano, width: 'auto', maxWidth: tamano * 1.8, objectFit: 'contain', opacity: opacidad }} />
        )}
      </div>
    </div>
  );
}
