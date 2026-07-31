import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import '../plantillas.css';

export default function LowerThird({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pl-wrap" style={estiloPersonalizado(config)}>
      <div className="pl-barra">
        {mostrar(config, 'mostrarLogo') && partido.equipoLocal.logo_url && <img className="pl-logo" src={partido.equipoLocal.logo_url} alt="" />}
        <span className="pl-nombre">{partido.equipoLocal.nombre}</span>
        <span className={`pl-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
        <span style={{ opacity: 0.5 }}>—</span>
        <span className={`pl-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
        <span className="pl-nombre">{partido.equipoVisita.nombre}</span>
        {mostrar(config, 'mostrarLogo') && partido.equipoVisita.logo_url && <img className="pl-logo" src={partido.equipoVisita.logo_url} alt="" />}
        {mostrar(config, 'mostrarFaltas') && <span className="pl-nombre">F {indicadorFaltas(partido.faltasLocal, config?.estiloFaltas)}-{indicadorFaltas(partido.faltasVisita, config?.estiloFaltas)}</span>}
        <span className="pl-nombre">{etiquetaPeriodo(partido.periodo)}{mostrar(config, 'mostrarReloj') ? ` · ${formatearReloj(partido.relojSegundos)}` : ''}</span>
      </div>
    </div>
  );
}
