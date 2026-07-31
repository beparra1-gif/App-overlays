import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function Minimal({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pm2-wrap" style={estiloPersonalizado(config)}>
      <div className="pm2-caja">
        <div className="pm2-equipo">
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pm2-logo" />
          <span className="pm2-nombre">{partido.equipoLocal.nombre}</span>
          <div className={`pm2-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div style={{ fontSize: 11, color: '#6b7280' }}>F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}</div>}
        </div>
        <div className="pm2-reloj">
          {mostrar(config, 'mostrarReloj') && formatearReloj(partido.relojSegundos)}
          <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>{etiquetaPeriodo(partido.periodo)}</div>
        </div>
        <div className="pm2-equipo">
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pm2-logo" />
          <span className="pm2-nombre">{partido.equipoVisita.nombre}</span>
          <div className={`pm2-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div style={{ fontSize: 11, color: '#6b7280' }}>F {indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
    </div>
  );
}
