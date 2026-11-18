import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { sigla, equipoDe, ptsDe, faltasDe, bonusDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 7 · Tablero de paletas — como el tablero de un aeropuerto: cada carácter
// es una paleta que "gira" (animación de volteo) cuando cambia su valor.
function Paletas({ texto, ancho, clase = '' }) {
  const s = String(texto).padStart(ancho, ' ').slice(-ancho);
  return (
    <span className={`sxa-paletas ${clase}`}>
      {s.split('').map((c, i) => <span key={`${i}-${c}`} className="sxa-paleta">{c === ' ' ? ' ' : c}</span>)}
    </span>
  );
}
function Fila({ partido, config, lado }) {
  return (
    <div className="sxa-fila">
      <Paletas texto={sigla(equipoDe(partido, lado))} ancho={3} />
      <span className="sxa-sep" />
      <Paletas texto={ptsDe(partido, lado)} ancho={3} clase="sxa-num" />
      {mostrar(config, 'mostrarFaltas') && <Paletas texto={bonusDe(partido, lado) ? 'B' : faltasDe(partido, lado)} ancho={1} clase={`sxa-faltas ${bonusDe(partido, lado) ? 'pm-bonus' : ''}`} />}
      <span className={`sxa-luz ${posesion(partido, config, lado) ? 'on' : ''}`} />
    </div>
  );
}
export default function TableroPaletas({ partido, config }) {
  return (
    <div className="plantilla-marcador sxa-wrap" style={estiloPersonalizado(config)}>
      <div className="sxa-caja">
        <div className="sxa-encabezado"><span>EQUIPO</span><span>PTS</span><span>{etiquetaPeriodo(partido.periodo)}</span></div>
        <Fila partido={partido} config={config} lado="local" />
        <Fila partido={partido} config={config} lado="visita" />
        {mostrar(config, 'mostrarReloj') && (
          <div className="sxa-fila sxa-fila-reloj"><Paletas texto={formatearReloj(Math.floor(partido.relojSegundos || 0))} ancho={5} clase="sxa-num" /><span className="sxa-estado">{partido.relojCorriendo ? 'EN JUEGO' : 'DETENIDO'}</span></div>
        )}
      </div>
    </div>
  );
}
