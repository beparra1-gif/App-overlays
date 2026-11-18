import { estiloTema, estiloTemaCapa, familiaEfectiva, fuenteEfectiva, formatearReloj, mostrar } from '../utils';
import { urlFotoJugador } from '../../api/client';
import LogoEquipo from '../LogoEquipo';
import { comparativaEquipos, lideresPartido, tablaPorPeriodo, tituloIntertanto } from '../intertanto';
import '../intertanto.css';

const CATEGORIAS_POR_DEFECTO = ['pts', 'reb', 'ast'];

function Escudo({ equipo, tema }) {
  if (equipo?.logo_url && mostrar(tema, 'mostrarLogo')) {
    return <LogoEquipo equipo={equipo} config={{ ...tema, logoTamanoEstadisticas: 96 }} contexto="estadisticas" className="it-escudo" />;
  }
  const inicial = (equipo?.codigo || equipo?.nombre || '?').slice(0, 3).toUpperCase();
  return <span className="it-escudo it-escudo-texto" style={{ background: equipo?.color }}>{inicial}</span>;
}

function Avatar({ jugador, color }) {
  if (jugador?.fotoUrl) return <img className="it-avatar" src={urlFotoJugador(jugador.fotoUrl)} alt="" style={{ borderColor: color }} />;
  return (
    <span className="it-avatar it-avatar-dorsal" style={{ borderColor: color, background: color }}>
      {jugador?.dorsal ?? '–'}
    </span>
  );
}

function Lider({ dato, color, lado }) {
  if (dato?.sinNomina) return <div className={`it-lider it-lider-${lado} it-lider-vacio`}>Sin nómina</div>;
  if (!dato) return <div className={`it-lider it-lider-${lado} it-lider-vacio`}>—</div>;
  return (
    <div className={`it-lider it-lider-${lado}`}>
      <Avatar jugador={dato.jugador} color={color} />
      <div className="it-lider-texto">
        <span className="it-lider-nombre">{dato.jugador.nombre || `#${dato.jugador.dorsal}`}</span>
        <span className="it-lider-dorsal">#{dato.jugador.dorsal ?? '–'}</span>
      </div>
      <span className="it-lider-valor">{dato.valor}</span>
    </div>
  );
}

function BarraComparativa({ fila, colorLocal, colorVisita }) {
  const total = fila.local + fila.visita;
  const pctLocal = total > 0 ? (fila.local / total) * 100 : 50;
  const mejorLocal = fila.menosEsMejor ? fila.local < fila.visita : fila.local > fila.visita;
  const mejorVisita = fila.menosEsMejor ? fila.visita < fila.local : fila.visita > fila.local;
  return (
    <div className="it-comp-fila">
      <span className={`it-comp-num ${mejorLocal ? 'it-mejor' : ''}`}>{fila.local}{fila.sufijo}</span>
      <div className="it-comp-centro">
        <span className="it-comp-etiqueta">{fila.etiqueta}</span>
        <div className="it-comp-barra">
          <span style={{ width: `${pctLocal}%`, background: colorLocal }} />
          <span style={{ width: `${100 - pctLocal}%`, background: colorVisita }} />
        </div>
      </div>
      <span className={`it-comp-num ${mejorVisita ? 'it-mejor' : ''}`}>{fila.visita}{fila.sufijo}</span>
    </div>
  );
}

// Intertanto: panel grande de resumen entre cuartos — marcador, puntos por
// cuarto y, SI hay nóminas cargadas, comparativa de equipo y líderes. Usa
// los colores/tipografía del diseño (capa propia "intertanto", con
// respaldo en los de Estadísticas y del marcador).
export default function VistaIntertanto({ partido, tema = {}, plantillaId, saliendo = false }) {
  if (!partido?.equipoLocal || !partido?.equipoVisita) return null;
  const { equipoLocal: local, equipoVisita: visita } = partido;
  const familia = familiaEfectiva(tema, 'intertanto', plantillaId);
  const { titulo, subtitulo } = tituloIntertanto(partido);
  const columnas = tablaPorPeriodo(partido);
  const categorias = Array.isArray(tema.intertantoCategorias) && tema.intertantoCategorias.length ? tema.intertantoCategorias : CATEGORIAS_POR_DEFECTO;
  const lideres = tema.intertantoLideres !== false ? lideresPartido(partido, categorias) : [];
  const comparativa = tema.intertantoComparativa !== false ? comparativaEquipos(partido) : [];
  const mostrarCuartos = tema.intertantoCuartos !== false;
  const colorLocal = local.color || '#0a84ff';
  const colorVisita = visita.color || '#ff3b30';
  const ganaLocal = partido.ptsLocal > partido.ptsVisita;
  const ganaVisita = partido.ptsVisita > partido.ptsLocal;
  const offsetY = Number(tema.intertantoOffsetY) || 0;

  const estilo = {
    ...estiloTema(tema),
    ...estiloTemaCapa(tema, 'estadisticas'),
    ...estiloTemaCapa(tema, 'intertanto'),
    '--pm-fuente': fuenteEfectiva(tema, plantillaId),
    '--it-local': colorLocal,
    '--it-visita': colorVisita,
    ...(offsetY ? { '--it-offset-y': `${offsetY}px` } : {}),
  };

  const sinDetalle = lideres.length === 0 && comparativa.length === 0;

  return (
    <div className={`it-overlay fam-${familia} ${saliendo ? 'it-saliendo' : ''}`} style={estilo}>
      <div className={`it-panel ${sinDetalle ? 'it-panel-compacto' : ''}`}>
        <div className="it-cabecera it-anim" style={{ '--it-delay': '0ms' }}>
          <span className="it-titulo">{titulo}</span>
          <span className="it-subtitulo">
            {subtitulo}
            {(Number(partido.relojSegundos) || 0) > 0 && <> · {formatearReloj(partido.relojSegundos)}</>}
          </span>
        </div>

        <div className="it-marcador it-anim" style={{ '--it-delay': '80ms' }}>
          <div className="it-equipo it-equipo-local">
            <Escudo equipo={local} tema={tema} />
            <span className="it-equipo-nombre">{local.nombre}</span>
          </div>
          <div className="it-puntos">
            <span className={`it-pts ${ganaLocal ? 'it-pts-gana' : ''}`}>{partido.ptsLocal}</span>
            <span className="it-pts-sep">–</span>
            <span className={`it-pts ${ganaVisita ? 'it-pts-gana' : ''}`}>{partido.ptsVisita}</span>
          </div>
          <div className="it-equipo it-equipo-visita">
            <span className="it-equipo-nombre">{visita.nombre}</span>
            <Escudo equipo={visita} tema={tema} />
          </div>
        </div>

        {mostrarCuartos && (
          <div className="it-cuartos it-anim" style={{ '--it-delay': '160ms', '--it-cols': columnas.length }}>
            <span className="it-cuartos-encabezado it-cuartos-equipo" />
            {columnas.map((c) => (
              <span key={c.periodo} className={`it-cuartos-encabezado ${c.actual ? 'it-actual' : ''}`}>{c.etiqueta}</span>
            ))}
            <span className="it-cuartos-encabezado it-cuartos-total">T</span>
            {[['local', local, colorLocal, partido.ptsLocal], ['visita', visita, colorVisita, partido.ptsVisita]].map(([lado, equipo, color, total]) => {
              const rival = lado === 'local' ? 'visita' : 'local';
              return (
                <div key={lado} className="it-cuartos-fila">
                  <span className="it-cuartos-equipo">
                    <i style={{ background: color }} />
                    {equipo.codigo || equipo.nombre}
                  </span>
                  {columnas.map((c) => (
                    <span
                      key={c.periodo}
                      className={`it-cuartos-celda ${c[lado] == null ? 'it-pendiente' : ''} ${c[lado] != null && c[lado] > c[rival] ? 'it-gana-cuarto' : ''}`}
                    >
                      {c[lado] ?? '–'}
                    </span>
                  ))}
                  <span className="it-cuartos-celda it-cuartos-total">{total}</span>
                </div>
              );
            })}
          </div>
        )}

        {!sinDetalle && (
          <div className={`it-cuerpo ${lideres.length && comparativa.length ? '' : 'it-cuerpo-una'}`}>
            {comparativa.length > 0 && (
              <section className="it-bloque it-anim" style={{ '--it-delay': '240ms' }}>
                <h4 className="it-bloque-titulo">Estadísticas de equipo</h4>
                {comparativa.map((fila) => (
                  <BarraComparativa key={fila.etiqueta} fila={fila} colorLocal={colorLocal} colorVisita={colorVisita} />
                ))}
              </section>
            )}
            {lideres.length > 0 && (
              <section className="it-bloque it-anim" style={{ '--it-delay': '320ms' }}>
                <h4 className="it-bloque-titulo">Líderes del partido</h4>
                {lideres.map((cat) => (
                  <div key={cat.clave} className="it-lideres-fila">
                    <Lider dato={cat.local} color={colorLocal} lado="local" />
                    <span className="it-lideres-cat">{cat.corta}</span>
                    <Lider dato={cat.visita} color={colorVisita} lado="visita" />
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
