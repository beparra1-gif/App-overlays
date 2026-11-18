import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar } from '../utils';
import LogoEquipo from '../LogoEquipo';
import { sigla, colorEquipo, faltasTexto, enBonus, tienePosesion } from './_comunNuevas';
import '../plantillas.css';
import '../plantillasNuevas.css';

// Torre lateral: el marcador en columna, pegado a la esquina superior
// izquierda — ocupa poco ancho, así no tapa la acción del centro de la
// cancha. Las faltas del período se ven como 5 pastillas.
function Equipo({ partido, config, lado }) {
  const equipo = lado === 'local' ? partido.equipoLocal : partido.equipoVisita;
  const pts = lado === 'local' ? partido.ptsLocal : partido.ptsVisita;
  const pulso = usePulso(pts);
  const faltas = Math.min(5, faltasTexto(partido, lado));
  return (
    <div className={`nvt-equipo ${mostrar(config, 'mostrarPosesion') && tienePosesion(partido, lado) ? 'nvt-con-posesion' : ''}`} style={{ '--nv-equipo': colorEquipo(equipo, lado === 'local' ? '#ff3b30' : '#0a84ff') }}>
      <LogoEquipo equipo={equipo} config={config} className="nvt-logo" />
      <span className="nvt-sigla">{sigla(equipo)}</span>
      <span className={`nvt-pts ${pulso ? 'pm-pulso' : ''}`}>{pts}</span>
      {mostrar(config, 'mostrarFaltas') && (
        <span className={`nvt-faltas ${enBonus(partido, lado) ? 'nvt-bonus' : ''}`} aria-label={`${faltas} faltas`}>
          {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < faltas ? 'on' : ''} />)}
        </span>
      )}
    </div>
  );
}

export default function TorreLateral({ partido, config }) {
  return (
    <div className="plantilla-marcador nvt-wrap" style={estiloPersonalizado(config)}>
      <div className="nvt-caja">
        <div className="nvt-cabeza">
          {mostrar(config, 'mostrarReloj') && <span className="nvt-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span className="nvt-periodo">{etiquetaPeriodo(partido.periodo)}</span>
        </div>
        <Equipo partido={partido} config={config} lado="local" />
        <Equipo partido={partido} config={config} lado="visita" />
      </div>
    </div>
  );
}
