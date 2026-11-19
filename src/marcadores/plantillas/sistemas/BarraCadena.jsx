import { formatearReloj, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, sigla, equipoDe, colorDe, posesion, timeoutsDe, ordinalPeriodo, Posesion24, logoCompetencia, tituloAdentro } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 20 · Barra de cadena — el clásico "bug" de TV: logo del canal o la
// competencia en un bloque negro, cada equipo en su color con sigla y
// puntaje, y el bloque de período/reloj/24". Debajo, rayitas con los tiempos
// muertos que le quedan a cada uno y el título. Al pedir un tiempo muerto,
// el bloque de ese equipo se vuelve "TIEMPO MUERTO" (partido.timeoutEn).
export default function BarraCadena({ partido, config }) {
  const [num, suf] = ordinalPeriodo(partido.periodo);
  const escudo = logoCompetencia(config);
  return (
    <div className="plantilla-marcador bcad-wrap" style={estiloPersonalizado(config)}>
      <div className="bcad-caja">
        <div className="bcad-fila">
          <span className="bcad-canal">{escudo ? <img src={escudo} alt="" /> : <b>EN VIVO</b>}</span>
          {['local', 'visita'].map((lado) => (
            partido.timeoutEn === lado ? (
              <span key={lado} className="bcad-equipo bcad-timeout" style={{ '--sx-equipo': colorDe(partido, lado) }}>TIEMPO MUERTO</span>
            ) : (
              <span key={lado} className="bcad-equipo" style={{ '--sx-equipo': colorDe(partido, lado) }}>
                <span className="bcad-sigla">{sigla(equipoDe(partido, lado))}</span>
                {posesion(partido, config, lado) && <i className="bcad-pos" aria-label="posesión" />}
                <Pts partido={partido} lado={lado} className="bcad-pts" />
              </span>
            )
          ))}
          <span className="bcad-info" data-pm-paleta>
            <span className="bcad-periodo">{num}<sup>{suf}</sup></span>
            {mostrar(config, 'mostrarReloj') && <span className="bcad-reloj">{formatearReloj(partido.relojSegundos)}</span>}
            <Posesion24 partido={partido} config={config} className="bcad-24" />
          </span>
        </div>
        <div className="bcad-pie">
          <span className="bcad-canal-pie" />
          {['local', 'visita'].map((lado) => (
            <span key={lado} className="bcad-sub">
              <span className="bcad-rayas" aria-label={`${timeoutsDe(partido, lado)} tiempos muertos`}>
                {Array.from({ length: Math.max(3, timeoutsDe(partido, lado)) }).map((_, i) => <i key={i} className={i < timeoutsDe(partido, lado) ? 'on' : ''} />)}
              </span>
              <Faltas partido={partido} config={config} lado={lado} className="bcad-faltas" />
            </span>
          ))}
          <span className="bcad-sub bcad-titulo">{tituloAdentro(config) || 'EN VIVO'}</span>
        </div>
      </div>
    </div>
  );
}
