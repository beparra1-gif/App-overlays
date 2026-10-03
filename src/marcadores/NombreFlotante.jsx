import { estiloTema, fuenteEfectiva } from './utils';

// Nombre del equipo "flotante" — alternativa a que viva ADENTRO de la caja
// de la plantilla (comportamiento de siempre, config[`${prefijo}NombrePosicion`]
// vacío o 'dentro'). Mismo espíritu que LogoFlotante: se ancla a la caja REAL
// ya medida (useCajaMarcador), así "arriba"/"abajo"/"costados" se acomodan
// solos si después movés o agrandás el marcador — no son coordenadas fijas.
//
// `prefijo` namespacea las claves de config (p. ej. 'clasico' →
// clasicoNombrePosicion/clasicoNombreOffsetX/...) para que cada plantilla
// que lo use tenga su PROPIO ajuste, sin pisarse entre sí si en el futuro se
// suma a más de una. Por ahora solo Clásico lo usa — esa plantilla suprime
// su <span> de nombre de siempre cuando este modo está activo, para no
// mostrarlo dos veces (ver Clasico.jsx).
//
// Reusa el mismo tamaño de letra que el nombre "de siempre" (12px *
// --pm-escala-nombre, ver estiloTema) — así el control "Tamaño del texto →
// Nombre de los equipos" sigue funcionando igual, sea cual sea la posición
// elegida acá.
export default function NombreFlotante({ equipoLocal, equipoVisita, config, plantillaId, caja, prefijo = 'clasico' }) {
  const posicion = config?.[`${prefijo}NombrePosicion`];
  if (!posicion || posicion === 'dentro') return null;
  if (!caja && posicion !== 'libre') return null;

  // Mismo ajuste fino (px) y misma convención "un solo control mueve los
  // dos lados, reflejados en espejo" que usa LogoFlotante — positivo separa
  // cada nombre hacia AFUERA del centro, negativo lo acerca. No aplica a
  // 'libre' (ahí cada nombre ya tiene su propia coordenada independiente).
  const offsetX = Number(config?.[`${prefijo}NombreOffsetX`]) || 0;
  const offsetY = Number(config?.[`${prefijo}NombreOffsetY`]) || 0;

  const estiloTexto = (equipo) => ({
    color: equipo.color,
    fontFamily: fuenteEfectiva(config, plantillaId),
    fontSize: 'calc(12px * var(--pm-escala-nombre, 1))',
    fontWeight: 700,
    letterSpacing: '.4px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    textShadow: '0 2px 6px rgba(0,0,0,.55)',
  });

  const raiz = { position: 'fixed', inset: 0, pointerEvents: 'none', ...estiloTema(config) };

  if (posicion === 'libre') {
    // Cada nombre tiene su propia coordenada (no hay "espejo" posible acá:
    // a diferencia de arriba/abajo/costados, que parten de la caja medida,
    // 'libre' es un punto propio por equipo, como Local y Visita son dos
    // elementos de verdad independientes en pantalla).
    const punto = (equipo, esLocal) => {
      const x = Number.isFinite(config?.[`${prefijo}Nombre${esLocal ? 'Local' : 'Visita'}X`])
        ? config[`${prefijo}Nombre${esLocal ? 'Local' : 'Visita'}X`] : 50;
      const y = Number.isFinite(config?.[`${prefijo}Nombre${esLocal ? 'Local' : 'Visita'}Y`])
        ? config[`${prefijo}Nombre${esLocal ? 'Local' : 'Visita'}Y`] : (esLocal ? 12 : 88);
      return (
        <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
          <span style={estiloTexto(equipo)}>{equipo.nombre}</span>
        </div>
      );
    };
    return <div style={raiz}>{punto(equipoLocal, true)}{punto(equipoVisita, false)}</div>;
  }

  if (posicion === 'costados') {
    const separacionPx = 14;
    const panelBase = { position: 'absolute', top: `${caja.topAlto}%`, height: `${caja.heightAlto}%`, display: 'flex', alignItems: 'center' };
    const lado = (equipo, ladoIzquierdo) => {
      const anchoDisponible = ladoIzquierdo ? caja.left : 100 - (caja.left + caja.width);
      const offsetLado = ladoIzquierdo ? -offsetX : offsetX;
      return (
        <div
          style={{
            ...panelBase,
            [ladoIzquierdo ? 'left' : 'right']: 0,
            width: `${Math.max(0, anchoDisponible)}%`,
            justifyContent: ladoIzquierdo ? 'flex-end' : 'flex-start',
            [ladoIzquierdo ? 'paddingRight' : 'paddingLeft']: separacionPx,
          }}
        >
          <span style={{ ...estiloTexto(equipo), transform: `translate(${offsetLado}px, ${offsetY}px)` }}>{equipo.nombre}</span>
        </div>
      );
    };
    return <div style={raiz}>{lado(equipoLocal, true)}{lado(equipoVisita, false)}</div>;
  }

  // 'arriba' / 'abajo': local a la izquierda del centro de la caja, visita a
  // la derecha — mismo criterio que ya usa la animación de puntos (+N) para
  // que los dos "miren hacia afuera" en vez de superponerse en el centro.
  const centroX = caja.left + caja.width / 2;
  const y = posicion === 'abajo' ? Math.min(100, caja.topAlto + caja.heightAlto + 3) : Math.max(0, caja.topAlto - 6);
  const lado = (equipo, esLocal) => {
    const x = esLocal ? Math.max(2, centroX - 6) : Math.min(98, centroX + 6);
    const offsetLado = esLocal ? -offsetX : offsetX;
    return (
      <div
        style={{
          position: 'absolute', top: `${y}%`, left: `${x}%`,
          transform: `translate(${esLocal ? '-100%' : '0%'}, -50%) translate(${offsetLado}px, ${offsetY}px)`,
        }}
      >
        <span style={estiloTexto(equipo)}>{equipo.nombre}</span>
      </div>
    );
  };
  return <div style={raiz}>{lado(equipoLocal, true)}{lado(equipoVisita, false)}</div>;
}
