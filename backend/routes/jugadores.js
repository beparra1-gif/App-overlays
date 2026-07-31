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

  try {
    await pool.query('DELETE FROM jugadores WHERE id = $1', [jugador.id]);
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /jugadores/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el jugador' });
  }
});

export default router;
