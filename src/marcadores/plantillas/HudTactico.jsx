import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

// Inspirada en un HUD militar/táctico: esquinas tipo mira, esquema
// oliva/negro/ámbar, tipografía técnica condensada — sin curvas ni
// bordes redondeados en ningún lado, a propósito, en contraste con el
// resto de las plantillas (la mayoría usa esquinas suaves).
export default function HudTactico({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pht-wrap" style={estiloPersonalizado(config)}>
      <div className="pht-caja">
        <span className="pht-esquina esquina-tl" />
        <span className="pht-esquina esquina-tr" />
        <span className="pht-esquina esquina-bl" />
        <span className="pht-esquina esquina-br" />
        <div className="pht-fila">
          <div className="pht-equipo">
            <LogoEquipo equipo={partido.equipoLocal} config={config} className="pht-logo" />
            <span className="pht-nombre">{partido.equipoLocal.nombre}</span>
            <span className={`pht-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          </div>
          <div className="pht-centro">
            <span className="pht-status">● EN VIVO</span>
            {mostrar(config, 'mostrarReloj') && <span className="pht-reloj">{formatearReloj(partido.relojSegundos)}</span>}
            <span className="pht-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          </div>
          <div className="pht-equipo">
            <span className={`pht-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
            <span className="pht-nombre">{partido.equipoVisita.nombre}</span>
            <LogoEquipo equipo={partido.equipoVisita} config={config} className="pht-logo" />
          </div>
        </div>
        {mostrar(config, 'mostrarFaltas') && (
          <div className="pht-pie">
            <span>FALTAS {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</span>
            <span>FALTAS {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
