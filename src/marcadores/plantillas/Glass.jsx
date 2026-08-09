import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function Glass({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pg-wrap" style={estiloPersonalizado(config)}>
      <div className="pg-caja">
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pg-logo" />
          <div className="pg-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`pg-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pg-nombre">F {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</div>}
        </div>
        <div className="pg-reloj">
          {mostrar(config, 'mostrarReloj') ? `${formatearReloj(partido.relojSegundos)} · ` : ''}{etiquetaPeriodo(partido.periodo)}
        </div>
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pg-logo" />
          <div className="pg-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`pg-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pg-nombre">F {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pc-patrocinador" />
    </div>
  );
}
