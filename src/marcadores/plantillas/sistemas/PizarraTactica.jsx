import { formatearReloj, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, sigla, equipoDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 3 · Pizarra táctica — la pizarra del entrenador: tiza, trazos a mano, el
// reloj dentro de un círculo dibujado y X/O de jugada de fondo.
function Equipo({ partido, config, lado }) {
  return (
    <div className="sxp-equipo">
      <span className="sxp-nombre"><Logo partido={partido} config={config} lado={lado} className="sxp-logo" />{sigla(equipoDe(partido, lado))}{posesion(partido, config, lado) && <i className="sxp-flecha">➜</i>}</span>
      <Pts partido={partido} lado={lado} className="sxp-pts" />
      <Faltas partido={partido} config={config} lado={lado} className="sxp-faltas" prefijo="faltas" />
    </div>
  );
}
export default function PizarraTactica({ partido, config }) {
  return (
    <div className="plantilla-marcador sxp-wrap" style={estiloPersonalizado(config)}>
      <div className="sxp-caja">
        <span className="sxp-xo" aria-hidden="true">X&nbsp;&nbsp;O&nbsp;&nbsp;X</span>
        <Equipo partido={partido} config={config} lado="local" />
        <div className="sxp-circulo">
          <span>{partido.periodo <= 4 ? `C${partido.periodo}` : `P${partido.periodo - 4}`}</span>
          {mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}
        </div>
        <Equipo partido={partido} config={config} lado="visita" />
      </div>
    </div>
  );
}
