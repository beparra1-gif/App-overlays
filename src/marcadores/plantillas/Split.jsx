import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function Split({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador psp-wrap" style={estiloPersonalizado(config)}>
      <div className="psp-caja">
        <div className="psp-lado" style={{ background: `${partido.equipoLocal.color}cc` }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="psp-logo" />
          <div className="psp-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`psp-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="psp-nombre">F {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</div>}
        </div>
        <div className="psp-centro">
          {mostrar(config, 'mostrarReloj') && <span className="psp-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span className="psp-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarPosesion') && partido.posesion && (
            <span className="psp-periodo">{partido.posesion === 'local' ? '◀' : '▶'}</span>
          )}
        </div>
        <div className="psp-lado" style={{ background: `${partido.equipoVisita.color}cc` }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="psp-logo" />
          <div className="psp-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`psp-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="psp-nombre">F {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pc-patrocinador" />
    </div>
  );
}
