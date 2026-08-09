import { etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function CircleFocus({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pcf-wrap" style={estiloPersonalizado(config)}>
      <div className="pcf-fila">
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pcf-logo" />
          <div className="pcf-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`pcf-pts-lado ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pcf-periodo">F {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</div>}
        </div>
        <div className="pcf-circulo">
          <span className="pcf-marcador">{etiquetaPeriodo(partido.periodo)}</span>
          <span className="pcf-periodo">EN VIVO</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pcf-logo" />
          <div className="pcf-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`pcf-pts-lado ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pcf-periodo">F {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
    </div>
  );
}
