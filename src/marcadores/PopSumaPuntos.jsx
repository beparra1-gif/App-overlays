import { usePulsoConDelta, estiloTema, estiloAnclaPop } from './utils';
import './popSuma.css';

function Badge({ estado, lado, tema, posicion, escala }) {
  if (!estado.pulso) return null;
  const estilo = {
    position: 'fixed', inset: 0, display: 'flex', pointerEvents: 'none',
    ...estiloTema(tema), ...estiloAnclaPop(tema, lado, posicion), '--pm-pop-escala': escala,
  };
  return (
    <div style={estilo}>
      <div className="pm-pop-suma" key={estado.clave}>+{estado.delta}!!</div>
    </div>
  );
}

// Capa compuesta (mismo truco de apilado que el resto: hermano position:fixed)
// que hace aparecer un "+2!!"/"+3!!"/"+1!!" al costado del marcador cada vez
// que sube el puntaje de un equipo — sin tocar ninguna de las 25 plantillas.
// Posición, tamaño y si se muestra o no se eligen desde el diseño
// (config.animacionPuntosPosicion/animacionPuntosTamano/mostrarAnimacionPuntos).
export default function PopSumaPuntos({ partido, config }) {
  const local = usePulsoConDelta(partido.ptsLocal);
  const visita = usePulsoConDelta(partido.ptsVisita);
  if (config?.mostrarAnimacionPuntos === false) return null;
  const posicion = config?.animacionPuntosPosicion || 'costado';
  const escala = Number.isFinite(config?.animacionPuntosTamano) ? config.animacionPuntosTamano / 100 : 1;
  return (
    <>
      <Badge estado={local} lado="local" tema={config} posicion={posicion} escala={escala} />
      <Badge estado={visita} lado="visita" tema={config} posicion={posicion} escala={escala} />
    </>
  );
}
