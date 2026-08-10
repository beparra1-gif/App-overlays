import pool from '../db.js';

// Cualquier cambio en el plantel de un equipo (agregar, editar o borrar un
// jugador) tiene que verse al instante en la Mesa de control de cualquier
// partido que ya tenga ese equipo cargado — sin esto, si el plantel se
// tocaba desde "Equipos" (una pantalla aparte, en otra pestaña) en vez de
// desde la propia Mesa, quien estuviera en la Mesa no se enteraba hasta
// recargar la página entera. Se usa desde routes/equipos.js (agregar) y
// routes/jugadores.js (editar/borrar) — un solo lugar para no repetir la
// misma consulta tres veces.
export async function avisarRosterActualizado(io, equipoId, userId) {
  if (!io) return;
  const jugadoresRes = await pool.query(
    'SELECT * FROM jugadores WHERE equipo_id = $1 AND temporal = false ORDER BY dorsal ASC NULLS LAST, nombre ASC',
    [equipoId]
  );
  const partidosRes = await pool.query(
    'SELECT public_token FROM partidos WHERE user_id = $1 AND (equipo_local_id = $2 OR equipo_visita_id = $2)',
    [userId, equipoId]
  );
  for (const partido of partidosRes.rows) {
    io.to(`partido:${partido.public_token}`).emit('roster_actualizado', { equipoId, jugadores: jugadoresRes.rows });
  }
}
