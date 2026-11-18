import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, equipoDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 8 · Afiche riso — impresión risográfica a dos tintas (rosa + azul) que se
// superponen con el registro apenas desfasado, sobre papel con grano.
export default function AficheRiso({ partido, config }) {
  return (
    <div className="plantilla-marcador sxr-wrap" style={estiloPersonalizado(config)}>
      <div className="sxr-caja">
        <div className="sxr-equipos">
          <span><Logo partido={partido} config={config} lado="local" className="sxr-logo" />{equipoDe(partido, 'local').nombre}{posesion(partido, config, 'local') ? ' ◀' : ''}</span>
          <span>{posesion(partido, config, 'visita') ? '▶ ' : ''}{equipoDe(partido, 'visita').nombre}<Logo partido={partido} config={config} lado="visita" className="sxr-logo" /></span>
        </div>
        <div className="sxr-marcador">
          <span className="sxr-doble" data-texto={`${partido.ptsLocal}—${partido.ptsVisita}`}>
            <Pts partido={partido} lado="local" />—<Pts partido={partido} lado="visita" />
          </span>
        </div>
        <div className="sxr-pie">
          <Faltas partido={partido} config={config} lado="local" className="sxr-faltas" />
          <span>{etiquetaPeriodo(partido.periodo)}{mostrar(config, 'mostrarReloj') ? ` · ${formatearReloj(partido.relojSegundos)}` : ''}</span>
          <Faltas partido={partido} config={config} lado="visita" className="sxr-faltas" />
        </div>
      </div>
    </div>
  );
}
