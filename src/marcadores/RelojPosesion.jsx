import { formatearPosesion, useRelojPosesion } from './utils';
import './relojPosesion.css';

// Reloj de posesión (24") en la transmisión, pegado a la caja real del
// marcador (al costado o debajo, según el diseño). Como en FIBA, se apaga
// cuando al reloj de juego le queda menos tiempo que a la posesión.
export default function RelojPosesion({ partido, config, caja, relojJuego, oculto = false, demo = false }) {
  const valorVivo = useRelojPosesion(partido);
  if (!config?.mostrarRelojPosesion || !caja || !partido) return null;
  const valor = demo ? 14 : valorVivo;
  const juego = Number(relojJuego ?? partido.relojSegundos);
  if (!demo && Number.isFinite(juego) && juego < valor && juego > 0) return null;
  const ubicacion = config.posesionUbicacion || 'derecha';
  const alto = Math.max(4, caja.heightAlto * (ubicacion === 'abajo' ? 0.45 : 0.8));
  const estilo = ubicacion === 'abajo'
    ? { left: `${caja.left + caja.width / 2}%`, top: `${caja.topAlto + caja.heightAlto + 0.6}%`, height: `${alto}%`, transform: 'translateX(-50%)' }
    : ubicacion === 'izquierda'
      ? { left: `${caja.left - 0.5}%`, top: `${caja.topAlto + caja.heightAlto / 2}%`, height: `${alto}%`, transform: 'translate(-100%, -50%)' }
      : { left: `${caja.left + caja.width + 0.5}%`, top: `${caja.topAlto + caja.heightAlto / 2}%`, height: `${alto}%`, transform: 'translateY(-50%)' };
  const estado = valor <= 0 ? 'rp-cero' : valor < 5 ? 'rp-alerta' : '';
  return (
    <div className={`reloj-posesion ${estado} ${oculto ? 'rp-oculto' : ''}`} style={{ ...estilo, '--rp-alto': `${alto * 0.5625}vw`, fontFamily: config?.fuenteMarcador || undefined }}>
      <span className="rp-valor">{formatearPosesion(valor)}</span>
    </div>
  );
}
