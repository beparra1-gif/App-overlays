import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import '../plantillas.css';

export default function RetroLed({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pled-wrap" style={estiloPersonalizado(config)}>
      <div className="pled-caja">
        <div style={{ textAlign: 'center' }}>
          <div className="pled-nombre">{partido.equipoLocal.nombre}</div>
          <div className={`pled-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{String(partido.ptsLocal).padStart(2, '0')}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pled-nombre">F{indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          {mostrar(config, 'mostrarReloj') && <div className="pled-reloj">{formatearReloj(partido.relojSegundos)}</div>}
          <div className="pled-nombre">{etiquetaPeriodo(partido.periodo)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="pled-nombre">{partido.equipoVisita.nombre}</div>
          <div className={`pled-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{String(partido.ptsVisita).padStart(2, '0')}</div>
          {mostrar(config, 'mostrarFaltas') && <div className="pled-nombre">F{indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</div>}
        </div>
      </div>
    </div>
  );
}
