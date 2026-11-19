import { formatearPosesion, useRelojPosesion } from './utils';
import { soporteDePlantilla } from './soporte';
import './relojPosesion.css';

// Mismo aspecto que la pieza del reloj de juego del tablero (ver paletaDeCaja).
const varsDePaleta = (p) => (p ? {
  '--rp-fondo': p.fondo, '--rp-textura': p.textura, '--rp-borde': p.borde, '--rp-radio': p.radio,
  '--rp-sombra': p.sombra, '--rp-color': p.texto, '--rp-fuente': p.fuente, '--rp-sombra-texto': p.sombraTexto,
} : {});

// Reloj de posesión (24") en la transmisión, pegado a la caja real del
// marcador (al costado o debajo, según el diseño). Como en FIBA, se apaga
// cuando al reloj de juego le queda menos tiempo que a la posesión.
export default function RelojPosesion({ partido, config, caja, relojJuego, oculto = false, demo = false, plantillaId }) {
  const valorVivo = useRelojPosesion(partido);
  if (!config?.mostrarRelojPosesion || !caja || !partido || soporteDePlantilla(plantillaId).reloj24Propio) return null;
  const valor = demo ? 14 : valorVivo;
  const juego = Number(relojJuego ?? partido.relojSegundos);
  if (!demo && Number.isFinite(juego) && juego < valor && juego > 0) return null;
  const ubicacion = config.posesionUbicacion || 'derecha';
  const tamano = (Number.isFinite(config.posesionTamano) ? config.posesionTamano : 100) / 100;
  const alto = Math.max(4, caja.heightAlto * (ubicacion === 'abajo' ? 0.45 : 0.8) * tamano);
  const estilo = ubicacion === 'abajo'
    ? { left: `${caja.left + caja.width / 2}%`, top: `${caja.topAlto + caja.heightAlto + 0.6}%`, height: `${alto}%`, transform: 'translateX(-50%)' }
    : ubicacion === 'izquierda'
      ? { left: `${caja.left - 0.5}%`, top: `${caja.topAlto + caja.heightAlto / 2}%`, height: `${alto}%`, transform: 'translate(-100%, -50%)' }
      : { left: `${caja.left + caja.width + 0.5}%`, top: `${caja.topAlto + caja.heightAlto / 2}%`, height: `${alto}%`, transform: 'translateY(-50%)' };
  const estado = valor <= 0 ? 'rp-cero' : valor < 5 ? 'rp-alerta' : '';
  return (
    <div className={`reloj-posesion ${estado} ${oculto ? 'rp-oculto' : ''}`} style={{ ...estilo, ...varsDePaleta(caja.paleta), fontFamily: config?.fuenteMarcador || undefined }}>
      <span className="rp-valor">{formatearPosesion(valor)}</span>
    </div>
  );
}
