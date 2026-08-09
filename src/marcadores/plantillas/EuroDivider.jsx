import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function EuroDivider({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador eu-wrap" style={estiloPersonalizado(config)}>
      <div className="eu-caja">
        <div className="eu-reloj-col">
          <span className="eu-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <span className="eu-reloj">{formatearReloj(partido.relojSegundos)}</span>}
        </div>
        <div className="eu-filas">
          <div className="eu-fila">
            {mostrar(config, 'mostrarPosesion') && partido.posesion === 'local' && <span className="eu-posesion">▸</span>}
            <span className="eu-nombre">{partido.equipoLocal.nombre}</span>
            {mostrar(config, 'mostrarFaltas') && <span className="eu-faltas">F{indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</span>}
            <span className={`eu-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
            <LogoEquipo equipo={partido.equipoLocal} config={config} className="eu-logo" />
          </div>
          <div className="eu-fila">
            {mostrar(config, 'mostrarPosesion') && partido.posesion === 'visita' && <span className="eu-posesion">▸</span>}
            <span className="eu-nombre">{partido.equipoVisita.nombre}</span>
            {mostrar(config, 'mostrarFaltas') && <span className="eu-faltas">F{indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>}
            <span className={`eu-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
            <LogoEquipo equipo={partido.equipoVisita} config={config} className="eu-logo" />
          </div>
        </div>
      </div>
    </div>
  );
}
