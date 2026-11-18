import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import { sigla, colorEquipo, faltasTexto, enBonus, tienePosesion } from './_comunNuevas';
import '../plantillas.css';
import '../plantillasNuevas.css';

// Brutalismo deportivo: bloques duros, bordes gruesos, sombra desplazada
// sin desenfoque, números gigantes condensados y una trama de semitono del
// color de cada equipo.
function Fila({ partido, config, lado }) {
  const equipo = lado === 'local' ? partido.equipoLocal : partido.equipoVisita;
  const pts = lado === 'local' ? partido.ptsLocal : partido.ptsVisita;
  const pulso = usePulso(pts);
  return (
    <div className="nvb-fila" style={{ '--nv-equipo': colorEquipo(equipo, lado === 'local' ? '#ff3b30' : '#0a84ff') }}>
      <div className="nvb-equipo">
        <LogoEquipo equipo={equipo} config={config} className="nvb-logo" />
        <span className="nvb-sigla">{sigla(equipo)}</span>
        {mostrar(config, 'mostrarPosesion') && tienePosesion(partido, lado) && <span className="nvb-posesion" aria-label="posesión">●</span>}
      </div>
      {mostrar(config, 'mostrarFaltas') && (
        <span className={`nvb-faltas ${enBonus(partido, lado) ? 'pm-bonus' : ''}`}>
          {enBonus(partido, lado) ? 'BONUS' : `F${indicadorFaltas(faltasTexto(partido, lado), config?.estiloFaltas)}`}
        </span>
      )}
      <span className={`nvb-pts ${pulso ? 'pm-pulso' : ''}`}>{pts}</span>
    </div>
  );
}

export default function Brutalista({ partido, config }) {
  return (
    <div className="plantilla-marcador nvb-wrap" style={estiloPersonalizado(config)}>
      <div className="nvb-caja">
        <div className="nvb-filas">
          <Fila partido={partido} config={config} lado="local" />
          <Fila partido={partido} config={config} lado="visita" />
        </div>
        <div className="nvb-tiempo">
          <span className="nvb-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <span className="nvb-reloj">{formatearReloj(partido.relojSegundos)}</span>}
        </div>
      </div>
    </div>
  );
}
