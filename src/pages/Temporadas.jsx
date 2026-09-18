import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatearReloj } from '../marcadores/utils';

// "Temporada" acá no es algo que el usuario cree a mano: es, simplemente,
// el conjunto de partidos guardados (ver Partidos.jsx → "Guardados") que
// comparten categoría/rama de equipo — aparece sola apenas se guarda el
// primer partido de esa categoría (ver backend/routes/temporadas.js). Esta
// pantalla junta tabla de posiciones, estadísticas acumuladas de jugador e
// historial de resultados de la categoría elegida.
const formatearFecha = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function EscudoOChip({ logoUrl, color }) {
  return logoUrl
    ? <img src={logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
    : <span className="chip-color" style={{ background: color || '#8e8e93' }} />;
}

const PESTANAS = [
  { id: 'tabla', etiqueta: '🏆 Tabla de posiciones' },
  { id: 'jugadores', etiqueta: '📊 Estadísticas de jugador' },
  { id: 'historial', etiqueta: '🗓️ Historial' },
];

function TablaPosiciones({ tabla }) {
  if (tabla === null) return <p className="texto-tenue">Cargando…</p>;
  if (tabla.length === 0) return <p className="texto-tenue">Sin partidos todavía en esta categoría.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
        <thead>
          <tr className="texto-tenue">
            <th style={{ textAlign: 'left' }}>#</th>
            <th style={{ textAlign: 'left' }}>Equipo</th>
            <th>PJ</th><th>G</th><th>P</th><th>PF</th><th>PC</th><th>Dif</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((e, i) => (
            <tr key={e.nombre} style={{ borderTop: '1px solid var(--borde)' }}>
              <td>{i + 1}</td>
              <td style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <EscudoOChip logoUrl={e.logoUrl} color={e.color} />
                {e.nombre}
              </td>
              <td>{e.partidosJugados}</td>
              <td>{e.victorias}</td>
              <td>{e.derrotas}</td>
              <td>{e.puntosAFavor}</td>
              <td>{e.puntosEnContra}</td>
              <td>{e.diferencia > 0 ? `+${e.diferencia}` : e.diferencia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EstadisticasJugadores({ jugadores }) {
  if (jugadores === null) return <p className="texto-tenue">Cargando…</p>;
  if (jugadores.length === 0) return <p className="texto-tenue">Sin jugadas registradas todavía en esta categoría.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr className="texto-tenue">
            <th>#</th><th style={{ textAlign: 'left' }}>Jugador</th><th style={{ textAlign: 'left' }}>Equipo</th>
            <th>PJ</th><th>PTS</th><th>PTS/PJ</th><th>REB</th><th>AST</th><th>ROB</th><th>PÉR</th><th>FAL</th>
          </tr>
        </thead>
        <tbody>
          {jugadores.map((j) => (
            <tr key={j.id} style={{ borderTop: '1px solid var(--borde)' }}>
              <td>{j.dorsal ?? '-'}</td>
              <td style={{ textAlign: 'left' }}>{j.nombre}</td>
              <td style={{ textAlign: 'left' }} className="texto-tenue">{j.equipoNombre}</td>
              <td>{j.partidosJugados}</td>
              <td>{j.pts}</td>
              <td>{j.promedioPts}</td>
              <td>{j.reb}</td>
              <td>{j.ast}</td>
              <td>{j.stl}</td>
              <td>{j.to}</td>
              <td>{j.faltas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Historial({ historial }) {
  if (historial === null) return <p className="texto-tenue">Cargando…</p>;
  if (historial.length === 0) return <p className="texto-tenue">Sin partidos todavía en esta categoría.</p>;
  return (
    <div className="grilla-tarjetas">
      {historial.map((p) => (
        <div className="tarjeta" key={p.id}>
          <div className="tarjeta-header">
            <EscudoOChip logoUrl={p.equipoLocalLogoUrl} color={p.equipoLocalColor} />
            <strong>{p.equipoLocalNombre}</strong>
            <span className="texto-tenue">vs</span>
            <strong>{p.equipoVisitaNombre}</strong>
            <EscudoOChip logoUrl={p.equipoVisitaLogoUrl} color={p.equipoVisitaColor} />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, margin: '6px 0' }}>{p.ptsLocal} — {p.ptsVisita}</p>
          <p className="texto-tenue">{formatearFecha(p.jugadoEn)}</p>
        </div>
      ))}
    </div>
  );
}

export default function Temporadas() {
  const [temporadas, setTemporadas] = useState(null);
  const [elegida, setElegida] = useState(null); // { categoria, rama } | null
  const [pestana, setPestana] = useState('tabla');
  const [tabla, setTabla] = useState(null);
  const [jugadores, setJugadores] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listarTemporadas()
      .then((d) => {
        setTemporadas(d.temporadas);
        if (d.temporadas.length > 0) setElegida({ categoria: d.temporadas[0].categoria, rama: d.temporadas[0].rama });
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!elegida) return;
    setTabla(null);
    setJugadores(null);
    setHistorial(null);
    api.obtenerTablaTemporada(elegida.categoria, elegida.rama).then((d) => setTabla(d.tabla)).catch((err) => setError(err.message));
    api.obtenerJugadoresTemporada(elegida.categoria, elegida.rama).then((d) => setJugadores(d.jugadores)).catch((err) => setError(err.message));
    api.obtenerHistorialTemporada(elegida.categoria, elegida.rama).then((d) => setHistorial(d.historial)).catch((err) => setError(err.message));
  }, [elegida]);

  return (
    <div className="pagina">
      <h1>Temporadas</h1>
      <p className="texto-tenue">
        Tabla de posiciones, estadísticas acumuladas de cada jugador e historial de resultados — agrupado solo por la
        categoría/rama que le pusiste a cada equipo en "Equipos" (Sub-15 Femenino, Primera, etc.), sin tener que armar
        nada a mano: aparece sola apenas guardás el primer partido de esa categoría (ver "Partidos → Guardados").
      </p>
      {error && <p className="mensaje-error">{error}</p>}

      {temporadas === null ? (
        <p className="texto-tenue">Cargando…</p>
      ) : temporadas.length === 0 ? (
        <p className="texto-tenue">
          Todavía no hay ningún partido guardado con categoría cargada. Ponele una categoría/rama al equipo en
          "Equipos" y jugá un partido — al reiniciarlo (o cuando lo archives) va a aparecer acá solo.
        </p>
      ) : (
        <>
          <div className="fila-form" style={{ margin: '16px 0' }}>
            <label style={{ flex: 1, minWidth: 220 }}>
              Categoría
              <select
                value={elegida ? `${elegida.categoria ?? ''}|${elegida.rama ?? ''}` : ''}
                onChange={(e) => {
                  const [categoria, rama] = e.target.value.split('|');
                  setElegida({ categoria: categoria || null, rama: rama || null });
                }}
              >
                {temporadas.map((t) => (
                  <option key={`${t.categoria}|${t.rama}`} value={`${t.categoria ?? ''}|${t.rama ?? ''}`}>
                    {t.categoria || 'Sin categoría'}{t.rama ? ` — ${t.rama}` : ''} ({t.partidos} partido{t.partidos === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pestanas-personalizacion">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pestana-btn ${pestana === p.id ? 'activa' : ''}`}
                onClick={() => setPestana(p.id)}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {pestana === 'tabla' && <TablaPosiciones tabla={tabla} />}
            {pestana === 'jugadores' && <EstadisticasJugadores jugadores={jugadores} />}
            {pestana === 'historial' && <Historial historial={historial} />}
          </div>
        </>
      )}
    </div>
  );
}
