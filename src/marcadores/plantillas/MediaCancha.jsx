import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import { sigla, colorEquipo, faltasTexto, enBonus, tienePosesion } from './_comunNuevas';
import '../plantillas.css';
import '../plantillasNuevas.css';

// Media cancha: el marcador dibujado como una cancha vista desde arriba —
// cada mitad teñida con el color de su equipo, línea central, llaves en los
// extremos y el reloj adentro del círculo central.
function Mitad({ partido, config, lado }) {
  const equipo = lado === 'local' ? partido.equipoLocal : partido.equipoVisita;
  const pts = lado === 'local' ? partido.ptsLocal : partido.ptsVisita;
  const pulso = usePulso(pts);
  return (
    <div className={`nvc-mitad nvc-mitad-${lado}`} style={{ '--nv-equipo': colorEquipo(equipo, lado === 'local' ? '#ff3b30' : '#0a84ff') }}>
      <span className="nvc-llave" aria-hidden="true" />
      <div className="nvc-datos">
        <span className="nvc-equipo">
          <LogoEquipo equipo={equipo} config={config} className="nvc-logo" />
          {sigla(equipo)}
          {mostrar(config, 'mostrarPosesion') && tienePosesion(partido, lado) && <b className="nvc-posesion">●</b>}
        </span>
        <span className={`nvc-pts ${pulso ? 'pm-pulso' : ''}`}>{pts}</span>
        {mostrar(config, 'mostrarFaltas') && (
          <span className={`nvc-faltas ${enBonus(partido, lado) ? 'pm-bonus' : ''}`}>F {indicadorFaltas(faltasTexto(partido, lado), config?.estiloFaltas)}</span>
        )}
      </div>
    </div>
  );
}

export default function MediaCancha({ partido, config }) {
  return (
    <div className="plantilla-marcador nvc-wrap" style={estiloPersonalizado(config)}>
      <div className="nvc-caja">
        <Mitad partido={partido} config={config} lado="local" />
        <div className="nvc-circulo">
          {mostrar(config, 'mostrarReloj') && <span className="nvc-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span className="nvc-periodo">{etiquetaPeriodo(partido.periodo)}</span>
        </div>
        <Mitad partido={partido} config={config} lado="visita" />
      </div>
    </div>
  );
}
