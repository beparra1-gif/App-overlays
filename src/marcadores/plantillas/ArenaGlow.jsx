import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function ArenaGlow({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pa-wrap" style={estiloPersonalizado(config)}>
      <span className="pa-resplandor" />
      <div className="pa-caja">
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pa-logo" />
          <div className="pa-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`pa-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pa-nombre">F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          {mostrar(config, 'mostrarReloj') && <div className="pa-reloj">{formatearReloj(partido.relojSegundos)}</div>}
          <div className="pa-nombre">{etiquetaPeriodo(partido.periodo)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pa-logo" />
          <div className="pa-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`pa-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pa-nombre">F {indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pc-patrocinador" />
    </div>
  );
}
