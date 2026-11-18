import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar, usePulso } from '../../utils';
import { Faltas, Logo, sigla, equipoDe, ptsDe, colorDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 5 · Cromo coleccionable — cada equipo es una carta con marco dorado y
// brillo holográfico; la carta "se da vuelta" cuando el equipo anota.
function Carta({ partido, config, lado }) {
  const pts = ptsDe(partido, lado);
  const pulso = usePulso(pts);
  return (
    <div className={`sxk-carta ${pulso ? 'sxk-gira' : ''} ${posesion(partido, config, lado) ? 'sxk-posesion' : ''}`} style={{ '--sx-equipo': colorDe(partido, lado) }}>
      <span className="sxk-franja">{sigla(equipoDe(partido, lado))}</span>
      <Logo partido={partido} config={config} lado={lado} className="sxk-logo" />
      <span className="sxk-pts">{pts}</span>
      <Faltas partido={partido} config={config} lado={lado} className="sxk-faltas" />
    </div>
  );
}
export default function CromoColeccionable({ partido, config }) {
  return (
    <div className="plantilla-marcador sxk-wrap" style={estiloPersonalizado(config)}>
      <div className="sxk-caja">
        <Carta partido={partido} config={config} lado="local" />
        <div className="sxk-centro">
          <span className="sxk-serie">Edición {new Date().getFullYear()}</span>
          {mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}
          <span>{etiquetaPeriodo(partido.periodo)}</span>
        </div>
        <Carta partido={partido} config={config} lado="visita" />
      </div>
    </div>
  );
}
