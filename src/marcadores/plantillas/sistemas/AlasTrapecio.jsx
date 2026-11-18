import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, sigla, equipoDe, colorDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 16 · Alas en trapecio — el marcador central y dos "alas" en trapecio con
// el nombre de cada equipo; el reloj va en una píldora roja colgando.
export default function AlasTrapecio({ partido, config }) {
  return (
    <div className="plantilla-marcador sxw-wrap" style={estiloPersonalizado(config)}>
      <div className="sxw-caja">
        <div className="sxw-fila">
          <span className="sxw-ala sxw-ala-local" style={{ '--sx-equipo': colorDe(partido, 'local') }}>
            <Logo partido={partido} config={config} lado="local" className="sxw-logo" />{sigla(equipoDe(partido, 'local'))}{posesion(partido, config, 'local') ? ' ◂' : ''}
          </span>
          <span className="sxw-centro"><Pts partido={partido} lado="local" /><i>-</i><Pts partido={partido} lado="visita" /></span>
          <span className="sxw-ala sxw-ala-visita" style={{ '--sx-equipo': colorDe(partido, 'visita') }}>
            {posesion(partido, config, 'visita') ? '▸ ' : ''}{sigla(equipoDe(partido, 'visita'))}<Logo partido={partido} config={config} lado="visita" className="sxw-logo" />
          </span>
        </div>
        <div className="sxw-pie">
          <Faltas partido={partido} config={config} lado="local" className="sxw-faltas" />
          <span className="sxw-reloj">{mostrar(config, 'mostrarReloj') ? formatearReloj(partido.relojSegundos) : ''} <small>{etiquetaPeriodo(partido.periodo)}</small></span>
          <Faltas partido={partido} config={config} lado="visita" className="sxw-faltas" />
        </div>
      </div>
    </div>
  );
}
