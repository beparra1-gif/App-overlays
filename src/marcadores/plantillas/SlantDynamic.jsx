import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function SlantDynamic({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador psl-wrap" style={estiloPersonalizado(config)}>
      <div className="psl-caja">
        <div className="psl-lado" style={{ background: partido.equipoLocal.color }}>
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="psl-logo" />
          <div className="psl-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`psl-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</div>
        </div>
        <div className="psl-centro">
          {mostrar(config, 'mostrarReloj') && <span className="psl-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span>{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarFaltas') && <span style={{ fontSize: 11 }}>F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}-{indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</span>}
        </div>
        <div className="psl-lado" style={{ background: partido.equipoVisita.color }}>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="psl-logo" />
          <div className="psl-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`psl-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</div>
        </div>
      </div>
    </div>
  );
}
