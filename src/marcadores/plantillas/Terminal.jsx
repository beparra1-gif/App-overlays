import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar } from '../utils';
import LogoEquipo from '../LogoEquipo';
import { sigla, colorEquipo, faltasTexto, enBonus, tienePosesion } from './_comunNuevas';
import '../plantillas.css';
import '../plantillasNuevas.css';

// Terminal: el marcador como una consola — monoespaciada, filas tipo
// tabla, faltas como barra de progreso de texto ([■■■□□]) y un cursor que
// titila al lado del reloj mientras corre.
function Linea({ partido, config, lado }) {
  const equipo = lado === 'local' ? partido.equipoLocal : partido.equipoVisita;
  const pts = lado === 'local' ? partido.ptsLocal : partido.ptsVisita;
  const pulso = usePulso(pts);
  const faltas = Math.min(5, faltasTexto(partido, lado));
  return (
    <div className="nvx-linea" style={{ '--nv-equipo': colorEquipo(equipo, '#22c55e') }}>
      <span className="nvx-prompt">{mostrar(config, 'mostrarPosesion') && tienePosesion(partido, lado) ? '▶' : '›'}</span>
      <LogoEquipo equipo={equipo} config={config} className="nvx-logo" />
      <span className="nvx-sigla">{sigla(equipo)}</span>
      <span className={`nvx-pts ${pulso ? 'pm-pulso' : ''}`}>{String(pts).padStart(3, ' ')}</span>
      {mostrar(config, 'mostrarFaltas') && (
        <span className={`nvx-faltas ${enBonus(partido, lado) ? 'pm-bonus' : ''}`}>
          [{'■'.repeat(faltas)}{'□'.repeat(5 - faltas)}]{enBonus(partido, lado) ? ' BONUS' : ''}
        </span>
      )}
    </div>
  );
}

export default function Terminal({ partido, config }) {
  return (
    <div className="plantilla-marcador nvx-wrap" style={estiloPersonalizado(config)}>
      <div className="nvx-caja">
        <div className="nvx-barra">
          <i /><i /><i />
          <span>score.live</span>
        </div>
        <Linea partido={partido} config={config} lado="local" />
        <Linea partido={partido} config={config} lado="visita" />
        <div className="nvx-linea nvx-estado">
          <span className="nvx-prompt">$</span>
          <span>{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && (
            <span className="nvx-reloj">
              {formatearReloj(partido.relojSegundos)}
              {partido.relojCorriendo && <span className="nvx-cursor" aria-hidden="true">█</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
