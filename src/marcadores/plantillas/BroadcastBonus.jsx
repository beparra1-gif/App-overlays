import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function BroadcastBonus({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);
  const mostrarTicker = mostrar(config, 'mostrarFaltas') || mostrar(config, 'mostrarPosesion');

  return (
    <div className="plantilla-marcador bb-wrap" style={estiloPersonalizado(config)}>
      <div className="bb-barra">
        <div className="bb-bloque">
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="bb-logo" />
          <span className="bb-nombre">{partido.equipoLocal.nombre}</span>
          <span className={`bb-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          {partido.bonusLocal && <span className="bb-bonus">BONUS</span>}
        </div>
        <div className="bb-centro">
          <span className="bb-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <span className="bb-reloj">{formatearReloj(partido.relojSegundos)}</span>}
        </div>
        <div className="bb-bloque bb-bloque-der">
          {partido.bonusVisita && <span className="bb-bonus">BONUS</span>}
          <span className={`bb-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          <span className="bb-nombre">{partido.equipoVisita.nombre}</span>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="bb-logo" />
        </div>
      </div>
      {mostrarTicker && (
        <div className="bb-ticker">
          {mostrar(config, 'mostrarFaltas') && <span>Faltas de equipo {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}-{indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</span>}
          {mostrar(config, 'mostrarFaltas') && mostrar(config, 'mostrarPosesion') && <span> · </span>}
          {mostrar(config, 'mostrarPosesion') && (
            <span>Posesión: {partido.posesion === 'visita' ? partido.equipoVisita.nombre : partido.equipoLocal.nombre}</span>
          )}
        </div>
      )}
    </div>
  );
}
