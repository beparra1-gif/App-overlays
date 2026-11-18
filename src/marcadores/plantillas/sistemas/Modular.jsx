import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Logo, Timeouts, sigla, equipoDe, colorDe, bonusDe, faltasDe } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 14 · Marcador modular — barra base con bloques del color de cada equipo y
// los tiempos muertos debajo; a la derecha se extiende una PESTAÑA de
// aviso cuando pasa algo que importa (bonus, faltas cargadas, posesión).
function aviso(partido, config) {
  for (const lado of ['local', 'visita']) {
    if (bonusDe(partido, lado)) return { texto: `${sigla(equipoDe(partido, lado))} en bonus`, sub: `${faltasDe(partido, lado)} faltas en el cuarto`, color: colorDe(partido, lado) };
  }
  for (const lado of ['local', 'visita']) {
    if (faltasDe(partido, lado) === 3) return { texto: `${sigla(equipoDe(partido, lado))} 3 faltas`, sub: 'a una de la penalización', color: colorDe(partido, lado) };
  }
  if (mostrar(config, 'mostrarPosesion') && partido.posesion) return { texto: `Posesión ${sigla(equipoDe(partido, partido.posesion))}`, sub: 'flecha alternada', color: colorDe(partido, partido.posesion) };
  return null;
}
function Bloque({ partido, config, lado }) {
  return (
    <div className="sxd-bloque" style={{ '--sx-equipo': colorDe(partido, lado) }}>
      <div className="sxd-bloque-fila">
        <Logo partido={partido} config={config} lado={lado} className="sxd-logo" />
        <span className="sxd-sigla">{sigla(equipoDe(partido, lado))}</span>
        <Pts partido={partido} lado={lado} className="sxd-pts" />
      </div>
      <div className="sxd-bloque-pie">
        <Timeouts partido={partido} lado={lado} className="sxd-to" />
        {mostrar(config, 'mostrarFaltas') && <span className={bonusDe(partido, lado) ? 'pm-bonus' : ''}>{bonusDe(partido, lado) ? 'BONUS' : `F${faltasDe(partido, lado)}`}</span>}
      </div>
    </div>
  );
}
export default function Modular({ partido, config }) {
  const a = aviso(partido, config);
  return (
    <div className="plantilla-marcador sxd-wrap" style={estiloPersonalizado(config)}>
      <div className="sxd-caja">
        <Bloque partido={partido} config={config} lado="local" />
        <Bloque partido={partido} config={config} lado="visita" />
        <div className="sxd-tiempo">
          <span>{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}
        </div>
        {a && (
          <div className="sxd-pestana" key={a.texto} style={{ '--sx-equipo': a.color }}>
            <b>{a.texto}</b><span>{a.sub}</span>
          </div>
        )}
      </div>
    </div>
  );
}
