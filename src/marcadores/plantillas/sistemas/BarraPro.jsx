import { formatearReloj, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, sigla, equipoDe, colorDe, posesion, timeoutsDe, ordinalPeriodo, Posesion24, tituloAdentro } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 18 · Barra Pro — barra de TV en tres bloques: cada equipo en su color con
// escudo, sigla y puntaje en un bloque más oscuro; a la derecha período,
// reloj en una cápsula clara y el 24". Debajo, una franja con faltas y
// tiempos muertos de cada uno y el título del partido.
export default function BarraPro({ partido, config }) {
  const [num, suf] = ordinalPeriodo(partido.periodo);
  return (
    <div className="plantilla-marcador bpro-wrap" style={estiloPersonalizado(config)}>
      <div className="bpro-caja">
        {['local', 'visita'].map((lado) => (
          <div key={lado} className="bpro-equipo" style={{ '--sx-equipo': colorDe(partido, lado) }}>
            <div className="bpro-fila">
              <span className="bpro-id">
                <Logo partido={partido} config={config} lado={lado} className="bpro-logo" />
                <span className="bpro-sigla">{sigla(equipoDe(partido, lado))}</span>
                {posesion(partido, config, lado) && <i className="bpro-pos" aria-label="posesión" />}
              </span>
              <Pts partido={partido} lado={lado} className="bpro-pts" />
            </div>
            <div className="bpro-sub">
              <Faltas partido={partido} config={config} lado={lado} prefijo="FALTAS" />
              <span>TM {timeoutsDe(partido, lado)}</span>
            </div>
          </div>
        ))}
        <div className="bpro-info">
          <div className="bpro-fila">
            <span className="bpro-periodo" data-pm-paleta>{num}<sup>{suf}</sup></span>
            {mostrar(config, 'mostrarReloj') && <span className="bpro-reloj">{formatearReloj(partido.relojSegundos)}</span>}
            <Posesion24 partido={partido} config={config} className="bpro-24" />
          </div>
          <div className="bpro-sub bpro-sub-info">{tituloAdentro(config) || 'EN VIVO'}</div>
        </div>
      </div>
    </div>
  );
}
