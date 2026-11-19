import { useEffect, useRef, useState } from 'react';
import { usePulsoConDelta, estiloTema, estiloAnclaPop } from './utils';
import './popSuma.css';

// No hay un emoji "3 dedos arriba" tal cual en Unicode — 🤟 (mano rock/te
// amo: pulgar+índice+meñique extendidos) es la aproximación más parecida y
// además ya se usa así, informalmente, para "triple" en básquet. ☝️/✌️ sí
// son one-to-one con 1 y 2. Encima de 3 puntos no hay mano (tiro libre
// entra en 1, así que máximo real por jugada es 3).
const MANO_POR_PUNTOS = { 1: '☝️', 2: '✌️', 3: '🤟' };

// Contenido del cartel según config.animacionPuntosIcono — cada "familia" es
// una forma de anunciar el punto, no una animación (eso es lo otro que ya se
// elige, animacionPuntosEstilo): números de siempre, o solo el gesto de la
// mano.
function contenidoIcono(icono, delta) {
  switch (icono) {
    case 'dedos':
      return MANO_POR_PUNTOS[delta] || `+${delta}`;
    case 'numero-dedos':
      return (
        <>
          {MANO_POR_PUNTOS[delta] && <span className="pm-pop-mano">{MANO_POR_PUNTOS[delta]}</span>}
          {`+${delta}!!`}
        </>
      );
    case 'numero':
    default:
      return `+${delta}!!`;
  }
}

const SIMBOLO_POR_ICONO = { estrellas: '⭐', balones: '🏀' };

// Mano estilo NBA: levanta 1, 2 o 3 dedos (índice, medio, anular) uno por uno.
const DEDOS = [{ x: 30, alto: 50 }, { x: 44, alto: 56 }, { x: 58, alto: 52 }, { x: 72, alto: 42 }];
function ManoNba({ delta }) {
  const n = Math.min(3, Math.max(1, delta));
  return (
    <span className="pm-pop-mano-nba">
      <svg viewBox="0 0 100 130" aria-hidden>
        {DEDOS.map((d, i) => {
          const arriba = i < n;
          return (
            <rect
              key={i} x={d.x - 6} width="13" rx="6.5"
              y={arriba ? 62 - d.alto : 48} height={arriba ? d.alto + 10 : 18}
              className={arriba ? 'dedo dedo-arriba' : 'dedo'} style={{ animationDelay: `${0.18 + i * 0.14}s` }}
            />
          );
        })}
        <rect x="21" y="52" width="62" height="56" rx="16" className="palma" />
        <rect x="9" y="70" width="13" height="34" rx="6.5" transform="rotate(-38 15 87)" className="dedo" />
        <rect x="24" y="104" width="56" height="16" rx="4" className="muneca" />
      </svg>
      <span className="pm-pop-mano-nba-num">+{delta}</span>
    </span>
  );
}

// Un balón por punto que cae y pica, en secuencia.
function BalonesAnimados({ delta }) {
  return Array.from({ length: Math.max(1, delta) }).map((_, i) => (
    <svg key={i} viewBox="0 0 40 40" className="pm-pop-balon" style={{ animationDelay: `${i * 0.22}s` }} aria-hidden>
      <circle cx="20" cy="20" r="18" />
      <path d="M2 20h36M20 2v36M7 7c7 7 7 19 0 26M33 7c-7 7-7 19 0 26" />
    </svg>
  ));
}

// Icono repetido tantas veces como puntos valga la jugada (⭐⭐ para un
// doble, 🏀🏀🏀 para un triple) — pero NO todos a la vez: cada uno aparece
// por separado, uno detrás de otro, como si se fueran "sumando" en pantalla
// (antes salían los 2-3 símbolos pegados en un solo texto, con una única
// animación para el bloque entero — se veían todos de golpe). Cada ícono
// tiene su propio pop-in (mismo timing para los 3 estilos, la variación de
// animacionPuntosEstilo ya la eligió el usuario para el modo numérico) con
// un `animation-delay` escalonado; el contenedor entero (`.pm-pop-suma`) no
// lleva animación propia acá, cada símbolo se anima solo.
function IconosSecuencia({ icono, delta }) {
  const simbolo = SIMBOLO_POR_ICONO[icono];
  const cantidad = Math.max(1, delta);
  return Array.from({ length: cantidad }).map((_, i) => (
    <span key={i} className="pm-pop-icono" style={{ animationDelay: `${i * 0.26}s` }}>{simbolo}</span>
  ));
}

function Badge({ estado, lado, tema, posicion, escala, estiloAnim, icono, caja }) {
  if (!estado.pulso) return null;
  const estilo = {
    position: 'fixed', inset: 0, display: 'flex', pointerEvents: 'none',
    ...estiloTema(tema), ...estiloAnclaPop(tema, lado, posicion, caja), '--pm-pop-escala': escala,
  };
  const esSecuencia = icono === 'estrellas' || icono === 'balones' || icono === 'balon-animado';
  const contenido = icono === 'mano-nba' ? <ManoNba delta={estado.delta} />
    : icono === 'balon-animado' ? <BalonesAnimados delta={estado.delta} />
    : esSecuencia ? <IconosSecuencia icono={icono} delta={estado.delta} />
    : contenidoIcono(icono, estado.delta);
  const clase = `pm-pop-suma ${esSecuencia || icono === 'mano-nba' ? 'pm-pop-secuencia' : (estiloAnim ? `pm-pop-${estiloAnim}` : '')} pm-pop-lado-${lado}`.trim();
  return (
    <div style={estilo}>
      <div className={clase} key={estado.clave}>
        {contenido}
      </div>
    </div>
  );
}

// Marca arrastrable (solo en el editor, `editable`) para el modo de posición
// "libre" — un punto propio en el lienzo, aparte de dónde esté el marcador;
// arrastrarlo actualiza animacionPuntosX/Y en vivo. Mismo mecanismo de
// arrastre que LogosLibres (getBoundingClientRect del lienzo, sin depender
// del zoom/escala de la vista previa).
function MarcaArrastrable({ x, y, onArrastrar, contenedorRef }) {
  const arrastrando = useRef(false);
  const mover = (e) => {
    if (!arrastrando.current || !contenedorRef?.current) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xPercent = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    onArrastrar?.(xPercent, yPercent);
  };
  const soltar = () => { arrastrando.current = false; };
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'auto' }} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar}>
      <div
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); arrastrando.current = true; }}
        title="Arrastrá para ubicar la animación de puntos"
        style={{
          position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)',
          width: 30, height: 30, borderRadius: '50%', background: 'rgba(10, 132, 255, .85)',
          border: '2px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,.5)', cursor: 'grab', touchAction: 'none',
        }}
      />
    </div>
  );
}

// Capa compuesta (mismo truco de apilado que el resto: hermano position:fixed)
// que hace aparecer un "+2!!"/"+3!!"/"+1!!" (o el ícono elegido) al costado
// del marcador cada vez que sube el puntaje de un equipo — sin tocar ninguna
// de las 25 plantillas. Posición, tamaño, estilo de animación e ícono se
// eligen desde el diseño (config.animacionPuntos*).
//
// `demo` (solo en el editor, ver PreviaCombinada): sin esto, la vista previa
// nunca muestra este cartel — usePulsoConDelta solo se activa con un cambio
// de puntaje REAL, y la vista previa usa datos de muestra fijos. Con `demo`
// se fuerzan dos pulsos fijos (2 y 3 puntos, uno por lado) para poder ver y
// ajustar tamaño/posición/ícono/animación sin tener que anotar puntos de
// verdad. `editable`/`onArrastrar`/`contenedorRef`: igual que en LogosLibres,
// solo tienen efecto con posición "libre". `caja` (ver useCajaMarcador): la
// caja del marcador ya medida de verdad — sin ella, 'costado'/'arriba' se
// anclaban con una aproximación fija que quedaba corrida en cuanto el
// diseño se alejaba del tamaño "típico" que esa aproximación asume (mismo
// bug ya corregido en Anuncios, ver estiloAnclaAlerta en utils.js).
export default function PopSumaPuntos({ partido, config, demo = false, editable = false, onArrastrar, contenedorRef, caja }) {
  const localReal = usePulsoConDelta(partido.ptsLocal);
  const visitaReal = usePulsoConDelta(partido.ptsVisita);
  // En la vista previa la animación se repite, para poder verla mientras se elige.
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!demo) return undefined;
    const t = setInterval(() => setVuelta((v) => v + 1), 3000);
    return () => clearInterval(t);
  }, [demo]);
  if (config?.mostrarAnimacionPuntos === false) return null;

  const local = demo ? { pulso: true, delta: 2, clave: `demo-local-${vuelta}` } : localReal;
  const visita = demo ? { pulso: true, delta: 3, clave: `demo-visita-${vuelta}` } : visitaReal;

  const posicion = config?.animacionPuntosPosicion || 'costado';
  const escala = Number.isFinite(config?.animacionPuntosTamano) ? config.animacionPuntosTamano / 100 : 1;
  const estiloAnim = config?.animacionPuntosEstilo || '';
  const icono = config?.animacionPuntosIcono || 'numero';
  const libreX = Number.isFinite(config?.animacionPuntosX) ? config.animacionPuntosX : 50;
  const libreY = Number.isFinite(config?.animacionPuntosY) ? config.animacionPuntosY : 50;

  return (
    <>
      <Badge estado={local} lado="local" tema={config} posicion={posicion} escala={escala} estiloAnim={estiloAnim} icono={icono} caja={caja} />
      <Badge estado={visita} lado="visita" tema={config} posicion={posicion} escala={escala} estiloAnim={estiloAnim} icono={icono} caja={caja} />
      {editable && posicion === 'libre' && (
        <MarcaArrastrable x={libreX} y={libreY} onArrastrar={onArrastrar} contenedorRef={contenedorRef} />
      )}
    </>
  );
}
