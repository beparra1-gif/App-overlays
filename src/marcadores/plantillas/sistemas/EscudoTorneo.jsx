import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, sigla, equipoDe, colorDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 15 · Escudo del torneo al centro — píldoras vibrantes del color de cada
// equipo y, en el medio, el escudo de la competencia (el primer "logo
// libre" del diseño; si no hay, una pelota). El reloj cuelga debajo.
function Pelota() {
  return (
    <svg viewBox="0 0 40 40" className="sxe-pelota" aria-hidden="true">
      <circle cx="20" cy="20" r="18" />
      <path d="M2 20h36M20 2v36M7 7c8 8 18 8 26 0M7 33c8-8 18-8 26 0" />
    </svg>
  );
}
export default function EscudoTorneo({ partido, config }) {
  const escudo = Array.isArray(config?.logosLibres) ? config.logosLibres[0]?.logoUrl : null;
  return (
    <div className="plantilla-marcador sxe-wrap" style={estiloPersonalizado(config)}>
      <div className="sxe-caja">
        <div className="sxe-fila">
          <span className="sxe-pildora sxe-local" style={{ '--sx-equipo': colorDe(partido, 'local') }}>
            {sigla(equipoDe(partido, 'local'))}{posesion(partido, config, 'local') ? ' ◂' : ''}
          </span>
          <Pts partido={partido} lado="local" className="sxe-pts" />
          <span className="sxe-escudo">{escudo ? <img src={escudo} alt="" /> : <Pelota />}</span>
          <Pts partido={partido} lado="visita" className="sxe-pts" />
          <span className="sxe-pildora sxe-visita" style={{ '--sx-equipo': colorDe(partido, 'visita') }}>
            {posesion(partido, config, 'visita') ? '▸ ' : ''}{sigla(equipoDe(partido, 'visita'))}
          </span>
        </div>
        <div className="sxe-reloj">
          <Faltas partido={partido} config={config} lado="local" className="sxe-faltas" />
          <span>{mostrar(config, 'mostrarReloj') ? `${formatearReloj(partido.relojSegundos)} · ` : ''}{etiquetaPeriodo(partido.periodo)}</span>
          <Faltas partido={partido} config={config} lado="visita" className="sxe-faltas" />
        </div>
      </div>
    </div>
  );
}
