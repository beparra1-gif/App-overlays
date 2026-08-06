import { estiloTema, estiloTemaCapa, estiloUbicacion, familiaEfectiva, fuenteEfectiva, formatearReloj } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../estadisticas.css';

function ItemStat({ valor, etiqueta }) {
  return (
    <div className="stats-item">
      <div className="stats-valor">{valor}</div>
      <div className="stats-etiqueta">{etiqueta}</div>
    </div>
  );
}

function FilaJugador({ j }) {
  return (
    <div className="stats-fila-jugador">
      <span className="stats-fila-dorsal">{j.dorsal ?? '-'}</span>
      <span className="stats-fila-nombre">{j.nombre}</span>
      <span className="stats-fila-num">{j.pts}</span>
      <span className="stats-fila-num">{j.reb}</span>
      <span className="stats-fila-num">{j.ast}</span>
      <span className="stats-fila-num">{j.faltas}</span>
      <span className="stats-fila-num">{formatearReloj(j.segundosJugados)}</span>
    </div>
  );
}

const etiquetaPeriodo = (periodo) => (periodo <= 4 ? `Q${periodo}` : `OT${periodo - 4}`);

// Puntos por cuarto de ESTE equipo, con el cuarto resaltado si anotó más que
// el rival en ese cuarto puntual (empate no resalta a nadie).
function PorPeriodo({ puntosPorPeriodo, equipoKey }) {
  if (!puntosPorPeriodo || puntosPorPeriodo.length === 0) return null;
  const rivalKey = equipoKey === 'local' ? 'visita' : 'local';
  return (
    <div className="stats-por-periodo">
      {puntosPorPeriodo.map((fila) => {
        const propio = fila[equipoKey] || 0;
        const rival = fila[rivalKey] || 0;
        return (
          <div key={fila.periodo} className={`stats-periodo-item ${propio > rival ? 'stats-periodo-superior' : ''}`}>
            <span className="stats-periodo-etiqueta">{etiquetaPeriodo(fila.periodo)}</span>
            <span className="stats-periodo-valor">{propio}</span>
          </div>
        );
      })}
    </div>
  );
}

// Encabezado con los dos escudos siempre centrados — el equipo (o el
// equipo del jugador, en modo individual) al que corresponden las
// estadísticas de abajo queda resaltado con un aro.
function EscudosAmbos({ equipoLocal, equipoVisita, equipoActivo, tema }) {
  return (
    <div className="stats-logos-ambos">
      <LogoEquipo equipo={equipoLocal} config={tema} contexto="estadisticas" className={`stats-logo ${equipoActivo === equipoLocal ? 'stats-logo-activo' : ''}`} />
      <span className="stats-vs">VS</span>
      <LogoEquipo equipo={equipoVisita} config={tema} contexto="estadisticas" className={`stats-logo ${equipoActivo === equipoVisita ? 'stats-logo-activo' : ''}`} />
    </div>
  );
}

// Cuerpo compartido (título + nombre + grilla + puntos por cuarto + detalle
// opcional por jugador) — lo único que cambia entre "un equipo a la vez" y
// "ambos a la vez" es el encabezado con el/los escudo(s), que se arma aparte.
function CuerpoEquipo({ equipo, equipoKey, puntosPorPeriodo, detalle }) {
  return (
    <>
      <div className="stats-titulo" style={{ textAlign: 'center' }}>Estadísticas de equipo</div>
      <div className="stats-nombre" style={{ color: equipo.color, textAlign: 'center' }}>{equipo.nombre}</div>
      <div className="stats-grilla">
        <ItemStat valor={equipo.totales.pts} etiqueta="PTS" />
        <ItemStat valor={equipo.totales.reb} etiqueta="REB" />
        <ItemStat valor={equipo.totales.ast} etiqueta="AST" />
        <ItemStat valor={equipo.totales.stl} etiqueta="ROB" />
        <ItemStat valor={equipo.totales.to} etiqueta="PÉR" />
        <ItemStat valor={equipo.totales.faltas} etiqueta="FAL" />
      </div>
      <PorPeriodo puntosPorPeriodo={puntosPorPeriodo} equipoKey={equipoKey} />
      {detalle && (
        <div className="stats-detalle">
          <div className="stats-fila-jugador stats-fila-encabezado">
            <span /><span>Jugador</span><span>PTS</span><span>REB</span><span>AST</span><span>FAL</span><span>MIN</span>
          </div>
          {equipo.roster.map((j) => <FilaJugador key={j.id} j={j} />)}
        </div>
      )}
    </>
  );
}

// Caja de un solo equipo para el modo "ambos" — a diferencia de EscudosAmbos
// (pensada para UN equipo a la vez, mostrando los dos escudos con uno
// resaltado para decir "esto es de acá"), acá las dos cajas ya están juntas
// en pantalla, así que cada una alcanza con mostrar su propio escudo.
function CajaEquipo({ equipo, equipoKey, tema, mostrarLogo, detalle, puntosPorPeriodo }) {
  return (
    <div className="stats-caja stats-caja-equipo stats-caja-ambos-item">
      {mostrarLogo && <LogoEquipo equipo={equipo} config={tema} contexto="estadisticas" className="stats-logo" />}
      <CuerpoEquipo equipo={equipo} equipoKey={equipoKey} puntosPorPeriodo={puntosPorPeriodo} detalle={detalle} />
    </div>
  );
}

export default function VistaEstadisticas({ partido, config = {}, tema, plantillaId }) {
  const modo = config.modo === 'jugador' ? 'jugador' : config.modo === 'ambos' ? 'ambos' : 'equipo';
  const familia = familiaEfectiva(tema, 'estadisticas', plantillaId);
  // El detalle por jugador se puede fijar fijo en el diseño, o pedirlo
  // puntual al disparar desde la Mesa (esto último gana si está prendido).
  const detalle = config?.detalle === true || tema?.mostrarDetalleJugadores === true;
  const mostrarLogo = tema?.logoEnEstadisticas !== false;
  // Un solo equipo sale pegado a SU lado de la pantalla (local ⇒ izquierda,
  // visita ⇒ derecha) en vez del lugar fijo que configura el diseño — así
  // se nota de entrada de qué equipo es sin tener que leer el nombre. Los
  // modos "ambos" y "jugador" siguen usando la ubicación del diseño, como
  // ya la tenían.
  const ubicacion = modo === 'equipo' ? (config.equipo === 'visita' ? 'derecha' : 'izquierda') : tema?.estadisticasPosicion;
  // Ajuste fino en px, encima del preset de ubicación — mismo criterio que
  // Nómina (ver nominaOffsetY en VistaNomina.jsx).
  const offsetY = Number(tema?.estadisticasOffsetY) || 0;
  const estilo = {
    ...estiloTema(tema), ...estiloTemaCapa(tema, 'estadisticas'), ...estiloUbicacion(ubicacion),
    '--pm-fuente': fuenteEfectiva(tema, plantillaId),
    ...(offsetY ? { transform: `translateY(${offsetY}px)` } : {}),
  };

  if (modo === 'ambos') {
    return (
      <div className={`stats-overlay fam-${familia}`} style={estilo}>
        <div className="stats-caja-ambos">
          <CajaEquipo equipo={partido.equipoLocal} equipoKey="local" tema={tema} mostrarLogo={mostrarLogo} detalle={detalle} puntosPorPeriodo={config.puntosPorPeriodo} />
          <CajaEquipo equipo={partido.equipoVisita} equipoKey="visita" tema={tema} mostrarLogo={mostrarLogo} detalle={detalle} puntosPorPeriodo={config.puntosPorPeriodo} />
        </div>
      </div>
    );
  }

  if (modo === 'jugador') {
    const equipoLocalTiene = partido.equipoLocal.roster.some((j) => j.id === config.jugadorId);
    const equipoDelJugador = equipoLocalTiene ? partido.equipoLocal : partido.equipoVisita;
    const jugador = equipoDelJugador.roster.find((j) => j.id === config.jugadorId);
    if (!jugador) return null;
    return (
      <div className={`stats-overlay fam-${familia}`} style={estilo}>
        <div className="stats-caja" key={jugador.id}>
          {mostrarLogo && (
            <EscudosAmbos equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} equipoActivo={equipoDelJugador} tema={tema} />
          )}
          <div className="stats-titulo" style={{ textAlign: 'center' }}>Estadísticas del jugador</div>
          <div className="stats-nombre" style={{ textAlign: 'center' }}>#{jugador.dorsal ?? '-'} {jugador.nombre}</div>
          <div className="stats-grilla">
            <ItemStat valor={jugador.pts} etiqueta="PTS" />
            <ItemStat valor={jugador.reb} etiqueta="REB" />
            <ItemStat valor={jugador.ast} etiqueta="AST" />
            <ItemStat valor={jugador.stl} etiqueta="ROB" />
            <ItemStat valor={jugador.to} etiqueta="PÉR" />
            <ItemStat valor={jugador.faltas} etiqueta="FAL" />
            <ItemStat valor={formatearReloj(jugador.segundosJugados)} etiqueta="MIN" />
          </div>
        </div>
      </div>
    );
  }

  const equipo = config.equipo === 'visita' ? partido.equipoVisita : partido.equipoLocal;
  const equipoKey = config.equipo === 'visita' ? 'visita' : 'local';
  return (
    <div className={`stats-overlay fam-${familia}`} style={estilo}>
      <div className="stats-caja stats-caja-equipo" key={config.equipo || 'local'}>
        {mostrarLogo && (
          <EscudosAmbos equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} equipoActivo={equipo} tema={tema} />
        )}
        <CuerpoEquipo equipo={equipo} equipoKey={equipoKey} puntosPorPeriodo={config.puntosPorPeriodo} detalle={detalle} />
      </div>
    </div>
  );
}
