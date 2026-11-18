import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import { colorEquipo, faltasTexto, enBonus, tienePosesion } from './_comunNuevas';
import '../plantillas.css';
import '../plantillasNuevas.css';

// Momentum: además del marcador, una barra que reparte el ancho según la
// proporción de puntos de cada equipo y marca la ventaja (+N) del que va
// arriba — se entiende quién domina sin leer los números.
export default function Momentum({ partido, config }) {
  const { equipoLocal: l, equipoVisita: v, ptsLocal, ptsVisita } = partido;
  const pulsoL = usePulso(ptsLocal);
  const pulsoV = usePulso(ptsVisita);
  const total = ptsLocal + ptsVisita;
  const pctLocal = total > 0 ? Math.round((ptsLocal / total) * 100) : 50;
  const diferencia = ptsLocal - ptsVisita;
  const colorL = colorEquipo(l, '#ff3b30');
  const colorV = colorEquipo(v, '#0a84ff');
  const meta = (lado) => (mostrar(config, 'mostrarFaltas')
    ? <span className={`nvm-meta ${enBonus(partido, lado) ? 'pm-bonus' : ''}`}>F {indicadorFaltas(faltasTexto(partido, lado), config?.estiloFaltas)}</span>
    : null);
  return (
    <div className="plantilla-marcador nvm-wrap" style={estiloPersonalizado(config)}>
      <div className="nvm-caja" style={{ '--nv-local': colorL, '--nv-visita': colorV }}>
        <div className="nvm-fila">
          <div className="nvm-equipo">
            <LogoEquipo equipo={l} config={config} className="nvm-logo" />
            <span className="nvm-nombre">{l.nombre}{mostrar(config, 'mostrarPosesion') && tienePosesion(partido, 'local') && <b className="nvm-posesion">◂</b>}</span>
            {meta('local')}
            <span className={`nvm-pts ${pulsoL ? 'pm-pulso' : ''}`}>{ptsLocal}</span>
          </div>
          <div className="nvm-centro">
            {mostrar(config, 'mostrarReloj') && <span className="nvm-reloj">{formatearReloj(partido.relojSegundos)}</span>}
            <span className="nvm-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          </div>
          <div className="nvm-equipo nvm-equipo-visita">
            <span className={`nvm-pts ${pulsoV ? 'pm-pulso' : ''}`}>{ptsVisita}</span>
            {meta('visita')}
            <span className="nvm-nombre">{mostrar(config, 'mostrarPosesion') && tienePosesion(partido, 'visita') && <b className="nvm-posesion">▸</b>}{v.nombre}</span>
            <LogoEquipo equipo={v} config={config} className="nvm-logo" />
          </div>
        </div>
        {/* La etiqueta de ventaja va en el centro del tramo del equipo que gana. */}
        <div className="nvm-barra" aria-hidden="true">
          <span className="nvm-barra-local" style={{ width: `${pctLocal}%` }} />
          <span className="nvm-barra-visita" style={{ width: `${100 - pctLocal}%` }} />
          {diferencia !== 0 && (
            <span className={`nvm-ventaja ${diferencia > 0 ? 'nvm-ventaja-local' : 'nvm-ventaja-visita'}`} style={{ left: `${diferencia > 0 ? pctLocal / 2 : pctLocal + (100 - pctLocal) / 2}%` }}>
              +{Math.abs(diferencia)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
