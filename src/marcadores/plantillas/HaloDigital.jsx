import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

// Inspirada en los HUD circulares de esports/sci-fi (no en ningún marcador
// de básquet real) — el puntaje vive DENTRO de un anillo que gira solo,
// mitad del color de cada equipo, en vez de una caja/barra como las demás
// 27 plantillas. A propósito la más distinta de todas: nada de bordes
// rectos ni cajas — todo circular.
export default function HaloDigital({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador phd-wrap" style={estiloPersonalizado(config)}>
      <div className="phd-caja">
        <div className="phd-lado">
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="phd-logo" />
          <span className="phd-nombre" style={{ color: partido.equipoLocal.color }}>{partido.equipoLocal.nombre}</span>
          {mostrar(config, 'mostrarFaltas') && <span className="phd-faltas">F {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</span>}
        </div>
        <div className="phd-anillo" style={{ '--color-local': partido.equipoLocal.color, '--color-visita': partido.equipoVisita.color }}>
          <div className="phd-anillo-giro" />
          <div className="phd-centro">
            <span className={`phd-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
            <span className="phd-separador">:</span>
            <span className={`phd-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          </div>
          <div className="phd-info">
            {mostrar(config, 'mostrarReloj') && <span className="phd-reloj">{formatearReloj(partido.relojSegundos)}</span>}
            <span className="phd-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          </div>
        </div>
        <div className="phd-lado">
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="phd-logo" />
          <span className="phd-nombre" style={{ color: partido.equipoVisita.color }}>{partido.equipoVisita.nombre}</span>
          {mostrar(config, 'mostrarFaltas') && <span className="phd-faltas">F {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>}
        </div>
      </div>
    </div>
  );
}
