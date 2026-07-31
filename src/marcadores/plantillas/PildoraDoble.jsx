import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function PildoraDoble({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pd-wrap" style={estiloPersonalizado(config)}>
      <div className="pd-columna">
        <div className="pd-encabezado">
          <span>{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <span>{formatearReloj(partido.relojSegundos)}</span>}
        </div>
        <div className="pd-pildora" style={{ '--pd-color': partido.equipoLocal.color }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pd-logo" />
          <span className="pd-nombre">{partido.equipoLocal.nombre}</span>
          {mostrar(config, 'mostrarFaltas') && <span className="pd-faltas">F{indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}</span>}
          {mostrar(config, 'mostrarPosesion') && partido.posesion === 'local' && <span className="pd-posesion">●</span>}
          <span className={`pd-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
        </div>
        <div className="pd-pildora" style={{ '--pd-color': partido.equipoVisita.color }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pd-logo" />
          <span className="pd-nombre">{partido.equipoVisita.nombre}</span>
          {mostrar(config, 'mostrarFaltas') && <span className="pd-faltas">F{indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</span>}
          {mostrar(config, 'mostrarPosesion') && partido.posesion === 'visita' && <span className="pd-posesion">●</span>}
          <span className={`pd-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
        </div>
      </div>
    </div>
  );
}
