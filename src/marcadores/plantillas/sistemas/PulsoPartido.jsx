import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, sigla, equipoDe, colorDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 10 · Pulso del partido — electrocardiograma de la ventaja: la línea une
// la diferencia acumulada al final de cada cuarto y el momento actual.
function trazo(partido) {
  const filas = partido.puntosPorPeriodo || [];
  let acum = 0;
  const puntos = [0];
  for (const f of filas) { acum += (f.local || 0) - (f.visita || 0); puntos.push(acum); }
  const actual = (partido.ptsLocal || 0) - (partido.ptsVisita || 0);
  if (puntos[puntos.length - 1] !== actual) puntos.push(actual);
  const max = Math.max(6, ...puntos.map((p) => Math.abs(p)));
  const ancho = 220;
  const paso = ancho / Math.max(1, puntos.length - 1);
  return { d: puntos.map((p, i) => `${i ? 'L' : 'M'}${(i * paso).toFixed(1)} ${(20 - (p / max) * 16).toFixed(1)}`).join(' '), actual, maxVentaja: Math.max(...puntos.map((p) => Math.abs(p))) };
}
export default function PulsoPartido({ partido, config }) {
  const { d, actual, maxVentaja } = trazo(partido);
  const lider = actual > 0 ? 'local' : actual < 0 ? 'visita' : null;
  return (
    <div className="plantilla-marcador sxl-wrap" style={estiloPersonalizado(config)}>
      <div className="sxl-caja" style={{ '--sx-local': colorDe(partido, 'local'), '--sx-visita': colorDe(partido, 'visita') }}>
        <div className="sxl-fila">
          <span className="sxl-sigla sxl-local">{sigla(equipoDe(partido, 'local'))}{posesion(partido, config, 'local') ? ' ●' : ''}</span>
          <Pts partido={partido} lado="local" className="sxl-pts" />
          <span className="sxl-centro">{etiquetaPeriodo(partido.periodo)}{mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}</span>
          <Pts partido={partido} lado="visita" className="sxl-pts" />
          <span className="sxl-sigla sxl-visita">{posesion(partido, config, 'visita') ? '● ' : ''}{sigla(equipoDe(partido, 'visita'))}</span>
        </div>
        <svg className="sxl-ecg" viewBox="0 0 220 40" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="20" x2="220" y2="20" className="sxl-base" />
          <path d={d} className={`sxl-linea ${lider ? `sxl-linea-${lider}` : ''}`} pathLength="1" />
        </svg>
        <div className="sxl-pie">
          <Faltas partido={partido} config={config} lado="local" className="sxl-faltas" />
          <span>{lider ? `Ventaja ${sigla(equipoDe(partido, lider))} +${Math.abs(actual)}` : 'Empate'} · máx. {maxVentaja}</span>
          <Faltas partido={partido} config={config} lado="visita" className="sxl-faltas" />
        </div>
      </div>
    </div>
  );
}
