import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

// Inspirada en la portada de un diario deportivo impreso: papel color
// crema con textura de trama (halftone), tipografía con serifa,
// regla doble como en un masthead de periódico. A propósito la ÚNICA de
// las 28 plantillas con fondo claro — todas las demás son oscuras — para
// que se note de un vistazo que es algo completamente distinto.
export default function DiarioDeportivo({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pdd-wrap" style={estiloPersonalizado(config)}>
      <div className="pdd-caja">
        <div className="pdd-cabecera">
          <span className="pdd-masthead">Edición especial</span>
          <span className="pdd-fecha">
            {etiquetaPeriodo(partido.periodo)}
            {mostrar(config, 'mostrarReloj') ? ` · ${formatearReloj(partido.relojSegundos)}` : ''}
          </span>
        </div>
        <div className="pdd-cuerpo">
          <div className="pdd-equipo">
            <LogoEquipo equipo={partido.equipoLocal} config={config} className="pdd-logo" />
            <span className="pdd-nombre">{partido.equipoLocal.nombre}</span>
            {mostrar(config, 'mostrarFaltas') && <span className="pdd-faltas">F{indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</span>}
          </div>
          <span className={`pdd-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          <span className="pdd-vs">–</span>
          <span className={`pdd-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          <div className="pdd-equipo">
            <LogoEquipo equipo={partido.equipoVisita} config={config} className="pdd-logo" />
            <span className="pdd-nombre">{partido.equipoVisita.nombre}</span>
            {mostrar(config, 'mostrarFaltas') && <span className="pdd-faltas">F{indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
