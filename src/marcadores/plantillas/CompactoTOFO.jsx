import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function CompactoTOFO({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador ct-wrap" style={estiloPersonalizado(config)}>
      <div className="ct-caja">
        <div className="ct-fila" style={{ borderLeftColor: partido.equipoLocal.color }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="ct-logo" />
          <span className="ct-nombre">{partido.equipoLocal.nombre}</span>
          {mostrar(config, 'mostrarFaltas') && (
            <span className="ct-badges">TO {partido.timeoutsLocal ?? 0} · FO {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</span>
          )}
          <span className={`ct-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          {mostrar(config, 'mostrarPosesion') && partido.posesion === 'local' && <span className="ct-posesion">◀</span>}
        </div>
        <div className="ct-fila" style={{ borderLeftColor: partido.equipoVisita.color }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="ct-logo" />
          <span className="ct-nombre">{partido.equipoVisita.nombre}</span>
          {mostrar(config, 'mostrarFaltas') && (
            <span className="ct-badges">TO {partido.timeoutsVisita ?? 0} · FO {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>
          )}
          <span className={`ct-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          {mostrar(config, 'mostrarPosesion') && partido.posesion === 'visita' && <span className="ct-posesion">▶</span>}
        </div>
        <div className="ct-pie">{mostrar(config, 'mostrarReloj') ? `${formatearReloj(partido.relojSegundos)} · ` : ''}{etiquetaPeriodo(partido.periodo)}</div>
      </div>
    </div>
  );
}
