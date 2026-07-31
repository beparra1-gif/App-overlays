import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import '../plantillas.css';

const abreviar = (nombre = '') => nombre.trim().slice(0, 3).toUpperCase() || '---';

export default function Ncaa({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);
  const mostrarLogo = mostrar(config, 'mostrarLogo');
  const tam = config?.logoTamano ? Math.min(config.logoTamano, 28) : 20;

  return (
    <div className="plantilla-marcador pu-wrap" style={estiloPersonalizado(config)}>
      <div className="pu-caja">
        <div className="pu-fila" style={{ borderLeft: `4px solid ${partido.equipoLocal.color}` }}>
          {mostrarLogo && partido.equipoLocal.logo_url && <img className="pu-logo" src={partido.equipoLocal.logo_url} alt="" style={{ width: tam, height: tam }} />}
          <span className="pu-abrev">{abreviar(partido.equipoLocal.nombre)}</span>
          <span className={`pu-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
        </div>
        <div className="pu-fila" style={{ borderLeft: `4px solid ${partido.equipoVisita.color}` }}>
          {mostrarLogo && partido.equipoVisita.logo_url && <img className="pu-logo" src={partido.equipoVisita.logo_url} alt="" style={{ width: tam, height: tam }} />}
          <span className="pu-abrev">{abreviar(partido.equipoVisita.nombre)}</span>
          <span className={`pu-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
        </div>
        <div className="pu-pie">
          <span>{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarFaltas') && <span>F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}-{indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</span>}
          {mostrar(config, 'mostrarReloj') && <span>{formatearReloj(partido.relojSegundos)}</span>}
        </div>
      </div>
    </div>
  );
}
