import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

async function jugadorDelUsuario(jugadorId, userId) {
  const resultado = await pool.query(
    `SELECT j.* FROM jugadores j
     JOIN equipos e ON e.id = j.equipo_id
     WHERE j.id = $1 AND e.user_id = $2`,
    [jugadorId, userId]
  );
  return resultado.rows[0] || null;
}

router.put('/:id', async (req, res) => {
  const jugador = await jugadorDelUsuario(req.params.id, req.userId);
  if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });

  const nombre = req.body?.nombre != null ? String(req.body.nombre).trim() : jugador.nombre;
  const dorsalRaw = req.body?.dorsal;
  const dorsal = dorsalRaw !== undefined ? (dorsalRaw === '' || dorsalRaw === null ? null : Number(dorsalRaw)) : jugador.dorsal;

  if (dorsal != null && !Number.isFinite(dorsal)) return res.status(400).json({ error: 'Dorsal inválido' });

  try {
    const resultado = await pool.query(
      'UPDATE jugadores SET nombre = $1, dorsal = $2 WHERE id = $3 RETURNING *',
      [nombre, dorsal, jugador.id]
    );
    res.json({ jugador: resultado.rows[0] });
  } catch (error) {
    console.error('[PUT /jugadores/:id]', error);
    res.status(500).json({ error: 'No se pudo actualizar el jugador' });
  }
});

router.delete('/:id', async (req, res) => {
  const jugador = await jugadorDelUsuario(req.params.id, req.userId);
  if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });

  // `?forzar=true`: el usuario ya vio cuántas jugadas tenía anotadas este
  // jugador y confirmó que las quiere borrar también — el puntaje total del
  // equipo NO se ve afectado (vive aparte, en partidos.pts_local/pts_visita,
  // ya sumado), solo se pierde el detalle de jugada-por-jugada de ESE
  // jugador puntual.
  const forzar = req.query.forzar === 'true';

  try {
    if (forzar) {
      await pool.query('DELETE FROM eventos_partido WHERE jugador_id = $1', [jugador.id]);
    }
    await pool.query('DELETE FROM jugadores WHERE id = $1', [jugador.id]);
    res.status(204).end();
  } catch (error) {
    // 23503 = violación de FK (postgres): el jugador ya tiene jugadas
    // anotadas en algún partido — antes esto era un error genérico sin
    // salida ("no se pudo eliminar"); ahora se le dice al frontend CUÁNTAS,
    // para que pueda ofrecer borrarlas junto con el jugador.
    if (error.code === '23503') {
      const bloqueando = await pool.query('SELECT COUNT(*)::int AS cantidad FROM eventos_partido WHERE jugador_id = $1', [jugador.id]);
      return res.status(409).json({ error: 'Este jugador tiene jugadas registradas', eventos_bloqueando: bloqueando.rows[0].cantidad });
    }
    console.error('[DELETE /jugadores/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el jugador' });
  }
});

export default router;
