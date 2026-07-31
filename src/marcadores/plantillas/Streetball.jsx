import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function Streetball({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador ps-wrap" style={estiloPersonalizado(config)}>
      <div className="ps-caja">
        <span className="ps-franja" />
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="ps-logo" />
          <div className="ps-nombre" style={{ color: partido.equipoLocal.color }}>{partido.equipoLocal.nombre}</div>
          <div className={`ps-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="ps-nombre">F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          {mostrar(config, 'mostrarReloj') && <div className="ps-reloj">{formatearReloj(partido.relojSegundos)}</div>}
          <div className="ps-nombre">{etiquetaPeriodo(partido.periodo)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="ps-logo" />
          <div className="ps-nombre" style={{ color: partido.equipoVisita.color }}>{partido.equipoVisita.nombre}</div>
          <div className={`ps-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="ps-nombre">F {indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
    </div>
  );
}
