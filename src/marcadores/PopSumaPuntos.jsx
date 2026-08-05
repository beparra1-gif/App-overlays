import { useRef } from 'react';
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
// elige, animacionPuntosEstilo): números de siempre, solo el gesto de la
// mano, los dos juntos, o un ícono repetido tantas veces como puntos valga
// la jugada (⭐⭐ para un doble, 🏀🏀🏀 para un triple).
function contenidoIcono(icono, delta) {
  const repetir = (simbolo) => simbolo.repeat(Math.max(1, delta));
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
    case 'estrellas':
      return repetir('⭐');
    case 'balones':
      return repetir('🏀');
    case 'numero':
    default:
      return `+${delta}!!`;
  }
}

function Badge({ estado, lado, tema, posicion, escala, estiloAnim, icono, caja }) {
  if (!estado.pulso) return null;
  const estilo = {
    position: 'fixed', inset: 0, display: 'flex', pointerEvents: 'none',
    ...estiloTema(tema), ...estiloAnclaPop(tema, lado, posicion, caja), '--pm-pop-escala': escala,
  };
  const clase = `pm-pop-suma ${estiloAnim ? `pm-pop-${estiloAnim}` : ''} pm-pop-lado-${lado}`.trim();
  return (
    <div style={estilo}>
      <div className={clase} key={estado.clave}>{contenidoIcono(icono, estado.delta)}</div>
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
  if (config?.mostrarAnimacionPuntos === false) return null;

  const local = demo ? { pulso: true, delta: 2, clave: 'demo-local' } : localReal;
  const visita = demo ? { pulso: true, delta: 3, clave: 'demo-visita' } : visitaReal;

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
