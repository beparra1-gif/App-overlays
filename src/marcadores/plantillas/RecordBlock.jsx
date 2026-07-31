import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

function PuntosTimeout({ cantidad = 0 }) {
  return (
    <span className="rb-puntos-to">
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className={`rb-punto ${i < cantidad ? 'llena' : ''}`} />
      ))}
    </span>
  );
}

export default function RecordBlock({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador rb-wrap" style={estiloPersonalizado(config)}>
      <div className="rb-caja">
        <div className="rb-columna">
          <div className="rb-fila" style={{ background: `linear-gradient(100deg, ${partido.equipoLocal.color} 55%, transparent 100%)` }}>
            <LogoEquipo equipo={partido.equipoLocal} config={config} className="rb-logo" />
            <span className="rb-nombre">{partido.equipoLocal.nombre}</span>
            {mostrar(config, 'mostrarPosesion') && partido.posesion === 'local' && <span className="rb-posesion">●</span>}
          </div>
          <div className="rb-fila" style={{ background: `linear-gradient(100deg, ${partido.equipoVisita.color} 55%, transparent 100%)` }}>
            <LogoEquipo equipo={partido.equipoVisita} config={config} className="rb-logo" />
            <span className="rb-nombre">{partido.equipoVisita.nombre}</span>
            {mostrar(config, 'mostrarPosesion') && partido.posesion === 'visita' && <span className="rb-posesion">●</span>}
          </div>
        </div>
        <div className="rb-columna rb-columna-pts">
          <span className={`rb-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          <span className={`rb-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
        </div>
        <div className="rb-panel">
          <span className="rb-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <span className="rb-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <div className="rb-to-grupo">
            <PuntosTimeout cantidad={partido.timeoutsLocal} />
            <PuntosTimeout cantidad={partido.timeoutsVisita} />
          </div>
        </div>
      </div>
    </div>
  );
}
