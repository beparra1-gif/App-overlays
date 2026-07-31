import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function Clasico({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pc-wrap" style={estiloPersonalizado(config)}>
      <div className="pc-caja">
        <div className="pc-equipo">
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pc-logo" />
          <span className="pc-nombre" style={{ color: partido.equipoLocal.color }}>{partido.equipoLocal.nombre}</span>
          <span className={`pc-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          {mostrar(config, 'mostrarFaltas') && <span className="pc-faltas">F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}</span>}
        </div>
        <div className="pc-centro">
          {mostrar(config, 'mostrarReloj') && <span className="pc-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span className="pc-periodo">{etiquetaPeriodo(partido.periodo)}</span>
        </div>
        <div className="pc-equipo">
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pc-logo" />
          <span className="pc-nombre" style={{ color: partido.equipoVisita.color }}>{partido.equipoVisita.nombre}</span>
          <span className={`pc-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          {mostrar(config, 'mostrarFaltas') && <span className="pc-faltas">F {indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</span>}
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pc-patrocinador" />
    </div>
  );
}
