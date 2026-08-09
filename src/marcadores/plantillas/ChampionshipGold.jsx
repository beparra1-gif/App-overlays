import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function ChampionshipGold({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pch-wrap" style={estiloPersonalizado(config)}>
      <div className="pch-caja">
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pch-logo" />
          <div className="pch-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`pch-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pch-nombre">F {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          {mostrar(config, 'mostrarReloj') && <div className="pch-reloj">{formatearReloj(partido.relojSegundos)}</div>}
          <div className="pch-nombre">{etiquetaPeriodo(partido.periodo)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pch-logo" />
          <div className="pch-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`pch-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pch-nombre">F {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pc-patrocinador" />
    </div>
  );
}
