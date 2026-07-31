import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import '../plantillas.css';

export default function EspnTicker({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pe-wrap" style={estiloPersonalizado(config)}>
      <div className="pe-barra">
        <div className="pe-bloque" style={{ borderLeft: `6px solid ${partido.equipoLocal.color}` }}>
          {mostrar(config, 'mostrarLogo') && partido.equipoLocal.logo_url && <img className="pe-logo" src={partido.equipoLocal.logo_url} alt="" />}
          <span className="pe-nombre">{partido.equipoLocal.nombre}</span>
          <span className={`pe-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
        </div>
        <div className="pe-centro">
          <span>{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <span>{formatearReloj(partido.relojSegundos)}</span>}
          {mostrar(config, 'mostrarFaltas') && <span>F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}-{indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</span>}
        </div>
        <div className="pe-bloque" style={{ borderRight: `6px solid ${partido.equipoVisita.color}` }}>
          <span className={`pe-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          <span className="pe-nombre">{partido.equipoVisita.nombre}</span>
          {mostrar(config, 'mostrarLogo') && partido.equipoVisita.logo_url && <img className="pe-logo" src={partido.equipoVisita.logo_url} alt="" />}
        </div>
      </div>
    </div>
  );
}
