import { formatearReloj, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, sigla, equipoDe, colorDe, posesion, timeoutsDe, ordinalPeriodo, Posesion24, logoCompetencia } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// Sol del medallón cuando el diseño no tiene logo de competencia.
function Sol() {
  const rayos = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8, b = a + Math.PI / 16, c = a - Math.PI / 16;
    return `M${20 + 7 * Math.cos(c)} ${20 + 7 * Math.sin(c)}L${20 + 17 * Math.cos(a)} ${20 + 17 * Math.sin(a)}L${20 + 7 * Math.cos(b)} ${20 + 7 * Math.sin(b)}Z`;
  });
  return (
    <svg viewBox="0 0 40 40" className="cmed-sol" aria-hidden="true">
      {rayos.map((d) => <path key={d} d={d} />)}
      <circle cx="20" cy="20" r="8" />
    </svg>
  );
}

// Tiempos muertos: columna de 5 luces, encendidas las que le quedan.
const Luces = ({ partido, lado }) => (
  <span className="cmed-luces" aria-label={`${timeoutsDe(partido, lado)} tiempos muertos`}>
    {Array.from({ length: 5 }).map((_, i) => <i key={i} className={i < timeoutsDe(partido, lado) ? 'on' : ''} />)}
  </span>
);

// 19 · Cápsula con medallón — cápsula metálica con los extremos del color de
// cada equipo (escudo + sigla), luces de tiempos muertos, puntaje con sus
// faltas debajo y un medallón dorado al centro con el escudo de la
// competencia. Debajo cuelga la pieza del período, el reloj y el 24".
export default function CapsulaMedallon({ partido, config }) {
  const [num, suf] = ordinalPeriodo(partido.periodo);
  const escudo = logoCompetencia(config);
  const lado = (l) => (
    <>
      <span className="cmed-cap" style={{ '--sx-equipo': colorDe(partido, l) }}>
        <Logo partido={partido} config={config} lado={l} className="cmed-logo" />
        <span className="cmed-sigla">{sigla(equipoDe(partido, l))}</span>
      </span>
      <Luces partido={partido} lado={l} />
      <span className="cmed-marca">
        <Pts partido={partido} lado={l} className="cmed-pts" />
        <span className="cmed-faltas">
          {posesion(partido, config, l) && <i className="cmed-pos" aria-label="posesión" />}
          <Faltas partido={partido} config={config} lado={l} prefijo="FALTAS:" />
        </span>
      </span>
    </>
  );
  return (
    <div className="plantilla-marcador cmed-wrap" style={estiloPersonalizado(config)}>
      <div className="cmed-caja">
        <div className="cmed-capsula">
          <div className="cmed-mitad cmed-local">{lado('local')}</div>
          <span className="cmed-medallon">{escudo ? <img src={escudo} alt="" /> : <Sol />}</span>
          <div className="cmed-mitad cmed-visita">{lado('visita')}</div>
        </div>
        <div className="cmed-pie">
          <span className="cmed-periodo">{num}{suf}</span>
          {mostrar(config, 'mostrarReloj') && <span className="cmed-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <Posesion24 partido={partido} config={config} className="cmed-24" />
        </div>
      </div>
    </div>
  );
}
