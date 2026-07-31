import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function Neon({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pne-wrap" style={estiloPersonalizado(config)}>
      <div className="pne-caja">
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pne-logo" />
          <div className="pne-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`pne-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pne-nombre">F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          {mostrar(config, 'mostrarReloj') && <div className="pne-reloj">{formatearReloj(partido.relojSegundos)}</div>}
          <div className="pne-nombre">{etiquetaPeriodo(partido.periodo)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pne-logo" />
          <div className="pne-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`pne-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pne-nombre">F {indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pc-patrocinador" />
    </div>
  );
}
