import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function OutlineBold({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador po-wrap" style={estiloPersonalizado(config)}>
      <div className="po-caja">
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="po-logo" />
          <div className="po-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`po-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="po-nombre">F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}</div>}
        </div>
        <div className="po-reloj">
          {mostrar(config, 'mostrarReloj') && formatearReloj(partido.relojSegundos)}
          <div style={{ fontSize: 12 }}>{etiquetaPeriodo(partido.periodo)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="po-logo" />
          <div className="po-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`po-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="po-nombre">F {indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
    </div>
  );
}
