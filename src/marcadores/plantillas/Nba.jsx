import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import '../plantillas.css';

function LogoCirculo({ equipo, config }) {
  if (!mostrar(config, 'mostrarLogo')) return null;
  const tam = config?.logoTamano || 44;
  if (equipo.logo_url) {
    return <img className="pn-logo-img" src={equipo.logo_url} alt={equipo.nombre} style={{ width: tam, height: tam }} />;
  }
  return (
    <span className="pn-logo-fallback" style={{ background: equipo.color, width: tam, height: tam }}>
      {(equipo.nombre || '?').charAt(0).toUpperCase()}
    </span>
  );
}

export default function Nba({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pn-wrap" style={estiloPersonalizado(config)}>
      <div className="pn-barra">
        <div className="pn-equipo">
          <LogoCirculo equipo={partido.equipoLocal} config={config} />
          <div className="pn-info">
            <span className="pn-nombre">{partido.equipoLocal.nombre}</span>
            <span className={`pn-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
            {mostrar(config, 'mostrarPosesion') && partido.posesion === 'local' && <span className="pn-posesion">● POSESIÓN</span>}
          </div>
        </div>
        <div className="pn-centro">
          {mostrar(config, 'mostrarReloj') && <span className="pn-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span className="pn-periodo">{etiquetaPeriodo(partido.periodo)}</span>
        </div>
        <div className="pn-equipo pn-visita">
          <LogoCirculo equipo={partido.equipoVisita} config={config} />
          <div className="pn-info">
            <span className="pn-nombre">{partido.equipoVisita.nombre}</span>
            <span className={`pn-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
            {mostrar(config, 'mostrarPosesion') && partido.posesion === 'visita' && <span className="pn-posesion">POSESIÓN ●</span>}
          </div>
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pn-patrocinador" />
    </div>
  );
}
