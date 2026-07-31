import { formatearReloj, usePulso, estiloPersonalizado, mostrar } from '../utils';
import '../plantillas.css';

export default function CornerMinimo({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pcb-wrap" style={estiloPersonalizado(config)}>
      <div className="pcb-caja">
        {mostrar(config, 'mostrarLogo') && partido.equipoLocal.logo_url && (
          <img className="pcb-logo" src={partido.equipoLocal.logo_url} alt="" style={{ height: config?.logoTamano || 20, width: 'auto', maxWidth: (config?.logoTamano || 20) * 1.8 }} />
        )}
        <span className={`pcb-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
        <span style={{ opacity: 0.6 }}>-</span>
        <span className={`pcb-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
        {mostrar(config, 'mostrarLogo') && partido.equipoVisita.logo_url && (
          <img className="pcb-logo" src={partido.equipoVisita.logo_url} alt="" style={{ height: config?.logoTamano || 20, width: 'auto', maxWidth: (config?.logoTamano || 20) * 1.8 }} />
        )}
        {mostrar(config, 'mostrarReloj') && <span className="pcb-reloj">{formatearReloj(partido.relojSegundos)}</span>}
      </div>
    </div>
  );
}
