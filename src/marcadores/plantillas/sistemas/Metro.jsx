import { formatearReloj, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, sigla, equipoDe, colorDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 6 · Metro — señalética de transporte: cada equipo es una "línea" con su
// círculo de color y el partido un recorrido de 4 estaciones (los cuartos).
function Linea({ partido, config, lado }) {
  return (
    <div className="sxm-linea">
      <span className="sxm-badge" style={{ background: colorDe(partido, lado) }}>{sigla(equipoDe(partido, lado))}</span>
      <Pts partido={partido} lado={lado} className="sxm-pts" />
      {posesion(partido, config, lado) && <span className="sxm-pos" aria-label="posesión">▶</span>}
      <Faltas partido={partido} config={config} lado={lado} className="sxm-faltas" />
    </div>
  );
}
export default function Metro({ partido, config }) {
  const total = Math.max(4, partido.periodo);
  return (
    <div className="plantilla-marcador sxm-wrap" style={estiloPersonalizado(config)}>
      <div className="sxm-caja">
        <div className="sxm-filas">
          <Linea partido={partido} config={config} lado="local" />
          <Linea partido={partido} config={config} lado="visita" />
        </div>
        <div className="sxm-recorrido">
          <div className="sxm-estaciones">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={`sxm-estacion ${i + 1 < partido.periodo ? 'pasada' : ''} ${i + 1 === partido.periodo ? 'actual' : ''}`}>
                <i />{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}
              </span>
            ))}
          </div>
          {mostrar(config, 'mostrarReloj') && <b className="sxm-reloj">{formatearReloj(partido.relojSegundos)}</b>}
        </div>
      </div>
    </div>
  );
}
