import { formatearReloj, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import { colorEquipo, faltasTexto, enBonus, tienePosesion } from './_comunNuevas';
import '../plantillas.css';
import '../plantillasNuevas.css';

// Estilo tipográfico internacional (suizo): la tipografía ES el diseño —
// grilla estricta, filetes finos, alineación a la izquierda, un único
// acento rojo (el cuadrado del período) y mucho aire.
function Columna({ partido, config, lado }) {
  const equipo = lado === 'local' ? partido.equipoLocal : partido.equipoVisita;
  const pts = lado === 'local' ? partido.ptsLocal : partido.ptsVisita;
  const pulso = usePulso(pts);
  return (
    <div className="nvs-col">
      <span className="nvs-nombre">
        <i style={{ background: colorEquipo(equipo, '#111') }} />
        {equipo.nombre}
        {mostrar(config, 'mostrarPosesion') && tienePosesion(partido, lado) && <b className="nvs-posesion">↘</b>}
      </span>
      <span className="nvs-fila-pts">
        <LogoEquipo equipo={equipo} config={config} className="nvs-logo" />
        <span className={`nvs-pts ${pulso ? 'pm-pulso' : ''}`}>{pts}</span>
      </span>
      {mostrar(config, 'mostrarFaltas') && (
        <span className={`nvs-meta ${enBonus(partido, lado) ? 'pm-bonus' : ''}`}>
          Faltas {indicadorFaltas(faltasTexto(partido, lado), config?.estiloFaltas)}{enBonus(partido, lado) ? ' — bonus' : ''}
        </span>
      )}
    </div>
  );
}

export default function Suizo({ partido, config }) {
  const periodo = partido.periodo <= 4 ? partido.periodo : `P${partido.periodo - 4}`;
  return (
    <div className="plantilla-marcador nvs-wrap" style={estiloPersonalizado(config)}>
      <div className="nvs-caja">
        <div className="nvs-periodo" title="Período">
          <span>{periodo}</span>
          <small>{partido.periodo <= 4 ? 'cuarto' : 'prórroga'}</small>
        </div>
        <Columna partido={partido} config={config} lado="local" />
        <Columna partido={partido} config={config} lado="visita" />
        {mostrar(config, 'mostrarReloj') && (
          <div className="nvs-col nvs-col-reloj">
            <span className="nvs-nombre">Tiempo</span>
            <span className="nvs-reloj">{formatearReloj(partido.relojSegundos)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
