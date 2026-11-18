import { formatearReloj, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, equipoDe, colorDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

const CUARTOS = ['', '1er cuarto', '2do cuarto', '3er cuarto', '4to cuarto'];

// 2 · Foco de arena — cine: fondo casi negro, un haz de luz barre el
// marcador cada tanto y los datos "se encienden" con un filo cálido.
function Equipo({ partido, config, lado }) {
  return (
    <div className={`sxf-equipo ${posesion(partido, config, lado) ? 'sxf-posesion' : ''}`} style={{ '--sx-equipo': colorDe(partido, lado) }}>
      <span className="sxf-nombre"><Logo partido={partido} config={config} lado={lado} className="sxf-logo" />{equipoDe(partido, lado).nombre}</span>
      <Pts partido={partido} lado={lado} className="sxf-pts" />
      <Faltas partido={partido} config={config} lado={lado} className="sxf-faltas" prefijo="Faltas" />
    </div>
  );
}
export default function FocoArena({ partido, config }) {
  const periodo = partido.periodo <= 4 ? CUARTOS[partido.periodo] : `Prórroga ${partido.periodo - 4}`;
  return (
    <div className="plantilla-marcador sxf-wrap" style={estiloPersonalizado(config)}>
      <div className="sxf-caja">
        <Equipo partido={partido} config={config} lado="local" />
        <div className="sxf-centro">
          {mostrar(config, 'mostrarReloj') && <b className="sxf-reloj">{formatearReloj(partido.relojSegundos)}</b>}
          <span className="sxf-periodo">{periodo}</span>
        </div>
        <Equipo partido={partido} config={config} lado="visita" />
        <span className="sxf-haz" aria-hidden="true" />
      </div>
    </div>
  );
}
