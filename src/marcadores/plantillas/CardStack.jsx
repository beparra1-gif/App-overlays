import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import '../plantillas.css';

export default function CardStack({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pcs-wrap" style={estiloPersonalizado(config)}>
      <div className="pcs-columna">
        <div className="pcs-tarjeta" style={{ borderLeftColor: partido.equipoLocal.color }}>
          {mostrar(config, 'mostrarLogo') && partido.equipoLocal.logo_url && <img className="pcs-logo" src={partido.equipoLocal.logo_url} alt="" />}
          <span className="pcs-nombre">{partido.equipoLocal.nombre}{mostrar(config, 'mostrarFaltas') ? ` · F${indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}` : ''}</span>
          <span className={`pcs-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
        </div>
        <div className="pcs-tarjeta" style={{ borderLeftColor: partido.equipoVisita.color }}>
          {mostrar(config, 'mostrarLogo') && partido.equipoVisita.logo_url && <img className="pcs-logo" src={partido.equipoVisita.logo_url} alt="" />}
          <span className="pcs-nombre">{partido.equipoVisita.nombre}{mostrar(config, 'mostrarFaltas') ? ` · F${indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}` : ''}</span>
          <span className={`pcs-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
        </div>
        <div className="pcs-reloj">{mostrar(config, 'mostrarReloj') ? `${formatearReloj(partido.relojSegundos)} · ` : ''}{etiquetaPeriodo(partido.periodo)}</div>
      </div>
    </div>
  );
}
