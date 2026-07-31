import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function Ticker({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pt-wrap" style={estiloPersonalizado(config)}>
      <div className="pt-barra">
        <div className="pt-seg">
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pt-logo" />
          <span className="pt-nombre">{partido.equipoLocal.nombre}</span>
          <span className={`pt-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
        </div>
        <span className="pt-sep">—</span>
        <div className="pt-seg">
          <span className={`pt-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          <span className="pt-nombre">{partido.equipoVisita.nombre}</span>
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pt-logo" />
        </div>
        {mostrar(config, 'mostrarFaltas') && (
          <>
            <span className="pt-sep">·</span>
            <span>F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}-{indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</span>
          </>
        )}
        <span className="pt-sep">·</span>
        <span>{etiquetaPeriodo(partido.periodo)}</span>
        {mostrar(config, 'mostrarReloj') && <span className="pt-reloj">{formatearReloj(partido.relojSegundos)}</span>}
      </div>
    </div>
  );
}
