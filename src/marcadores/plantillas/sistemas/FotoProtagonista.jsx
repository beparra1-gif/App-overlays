import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { urlFotoJugador } from '../../../api/client';
import { Pts, Faltas, sigla, equipoDe, colorDe, lider, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 11 · Foto protagonista — el marcador lleva al costado la foto del
// goleador del partido (de la nómina) con su número grande apilado.
export default function FotoProtagonista({ partido, config }) {
  const candidatos = [lider(partido.equipoLocal), lider(partido.equipoVisita)].filter(Boolean);
  const figura = candidatos.sort((a, b) => (b.pts || 0) - (a.pts || 0))[0];
  const ladoFigura = figura && partido.equipoLocal.roster?.some((j) => j.id === figura.id) ? 'local' : 'visita';
  return (
    <div className="plantilla-marcador sxh-wrap" style={estiloPersonalizado(config)}>
      <div className="sxh-caja">
        {figura && (
          <div className="sxh-figura" style={{ '--sx-equipo': colorDe(partido, ladoFigura) }}>
            {figura.fotoUrl ? <img src={urlFotoJugador(figura.fotoUrl)} alt="" className="sxh-foto" /> : <span className="sxh-foto sxh-foto-dorsal">{figura.dorsal ?? '–'}</span>}
            <span className="sxh-figura-num">{figura.pts}<small>PTS</small></span>
            <span className="sxh-figura-nombre">#{figura.dorsal ?? '–'} {figura.nombre}</span>
          </div>
        )}
        <div className="sxh-marcador">
          {['local', 'visita'].map((lado) => (
            <div key={lado} className="sxh-fila" style={{ '--sx-equipo': colorDe(partido, lado) }}>
              <span className="sxh-sigla">{sigla(equipoDe(partido, lado))}{posesion(partido, config, lado) ? ' ◂' : ''}</span>
              <Faltas partido={partido} config={config} lado={lado} className="sxh-faltas" />
              <Pts partido={partido} lado={lado} className="sxh-pts" />
            </div>
          ))}
          <div className="sxh-tiempo">{etiquetaPeriodo(partido.periodo)}{mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}</div>
        </div>
      </div>
    </div>
  );
}
