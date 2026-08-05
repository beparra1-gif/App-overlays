import { formatearReloj } from '../marcadores/utils';

// Tabla de estadísticas completas por jugador (PTS/REB/AST/ROB/PÉR/FAL/MIN)
// de un equipo — mismo formato que ya arma el backend (construirEstado:
// equipo.roster), tanto para un partido en vivo como para uno guardado
// (archivarPartido guarda exactamente esta misma forma en `resumen`), así
// que este componente sirve para los dos casos sin distinguir cuál es cuál.
function TablaEquipo({ equipo }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <strong>{equipo.nombre}</strong>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 6 }}>
        <thead>
          <tr className="texto-tenue">
            <th>#</th><th style={{ textAlign: 'left' }}>Jugador</th><th>PTS</th><th>REB</th><th>AST</th><th>ROB</th><th>PÉR</th><th>FAL</th><th>MIN</th>
          </tr>
        </thead>
        <tbody>
          {equipo.roster.map((j) => (
            <tr key={j.id}>
              <td>{j.dorsal ?? '-'}</td>
              <td style={{ textAlign: 'left' }}>{j.nombre}</td>
              <td>{j.pts}</td>
              <td>{j.reb}</td>
              <td>{j.ast}</td>
              <td>{j.stl}</td>
              <td>{j.to}</td>
              <td>{j.faltas}</td>
              <td>{formatearReloj(j.segundosJugados)}</td>
            </tr>
          ))}
          {equipo.roster.length === 0 && (
            <tr><td colSpan={9} className="texto-tenue">Sin jugadores con minutos registrados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function TablaEstadisticas({ equipoLocal, equipoVisita }) {
  return (
    <>
      <TablaEquipo equipo={equipoLocal} />
      <TablaEquipo equipo={equipoVisita} />
    </>
  );
}
