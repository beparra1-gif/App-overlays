import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Medallon, Pts, Faltas, Reaccion, colorDe, sigla, equipoDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 1 · Crossover — color plano de camiseta, medallones parejos, todo
// inclinado como un corte de dribbling; el puntaje "corta" de costado.
function Bloque({ partido, config, lado }) {
  return (
    <div className={`sxc-bloque sxc-${lado} ${posesion(partido, config, lado) ? 'sxc-posesion' : ''}`} style={{ '--sx-equipo': colorDe(partido, lado) }}>
      <Medallon partido={partido} config={config} lado={lado} className="sxc-medallon" />
      <span className="sxc-sigla">{sigla(equipoDe(partido, lado))}</span>
      <Pts partido={partido} lado={lado} className="sxc-pts" />
      <Faltas partido={partido} config={config} lado={lado} className="sxc-faltas" />
      <Reaccion partido={partido} lado={lado} className="sxc-reaccion" />
    </div>
  );
}
export default function Crossover({ partido, config }) {
  return (
    <div className="plantilla-marcador sxc-wrap" style={estiloPersonalizado(config)}>
      <div className="sxc-caja">
        <Bloque partido={partido} config={config} lado="local" />
        <div className="sxc-tiempo">
          <span>{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}
        </div>
        <Bloque partido={partido} config={config} lado="visita" />
      </div>
    </div>
  );
}
