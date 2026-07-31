import { usePulsoConDelta, estiloTema, estiloAnclaPop } from './utils';
import './popSuma.css';

// No hay un emoji "3 dedos arriba" tal cual en Unicode — 🤟 (mano rock/te
// amo: pulgar+índice+meñique extendidos) es la aproximación más parecida y
// además ya se usa así, informalmente, para "triple" en básquet. ☝️/✌️ sí
// son one-to-one con 1 y 2. Encima de 3 puntos no hay mano (tiro libre
// entra en 1, así que máximo real por jugada es 3).
const MANO_POR_PUNTOS = { 1: '☝️', 2: '✌️', 3: '🤟' };

function Badge({ estado, lado, tema, posicion, escala, estiloAnim, conMano }) {
  if (!estado.pulso) return null;
  const estilo = {
    position: 'fixed', inset: 0, display: 'flex', pointerEvents: 'none',
    ...estiloTema(tema), ...estiloAnclaPop(tema, lado, posicion), '--pm-pop-escala': escala,
  };
  const mano = conMano ? MANO_POR_PUNTOS[estado.delta] : null;
  const clase = `pm-pop-suma ${estiloAnim ? `pm-pop-${estiloAnim}` : ''} pm-pop-lado-${lado}`.trim();
  return (
    <div style={estilo}>
      <div className={clase} key={estado.clave}>
        {mano && <span className="pm-pop-mano">{mano}</span>}
        +{estado.delta}!!
      </div>
    </div>
  );
}

// Capa compuesta (mismo truco de apilado que el resto: hermano position:fixed)
// que hace aparecer un "+2!!"/"+3!!"/"+1!!" al costado del marcador cada vez
// que sube el puntaje de un equipo — sin tocar ninguna de las 25 plantillas.
// Posición, tamaño, estilo de animación y si se muestra o no se eligen desde
// el diseño (config.animacionPuntos*).
export default function PopSumaPuntos({ partido, config }) {
  const local = usePulsoConDelta(partido.ptsLocal);
  const visita = usePulsoConDelta(partido.ptsVisita);
  if (config?.mostrarAnimacionPuntos === false) return null;
  const posicion = config?.animacionPuntosPosicion || 'costado';
  const escala = Number.isFinite(config?.animacionPuntosTamano) ? config.animacionPuntosTamano / 100 : 1;
  const estiloAnim = config?.animacionPuntosEstilo || '';
  const conMano = Boolean(config?.animacionPuntosConMano);
  return (
    <>
      <Badge estado={local} lado="local" tema={config} posicion={posicion} escala={escala} estiloAnim={estiloAnim} conMano={conMano} />
      <Badge estado={visita} lado="visita" tema={config} posicion={posicion} escala={escala} estiloAnim={estiloAnim} conMano={conMano} />
    </>
  );
}
