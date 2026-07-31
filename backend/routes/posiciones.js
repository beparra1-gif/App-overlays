import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Presets de posición+tamaño de marcador, guardados por cuenta — separados
// del color de un diseño, para reusar el mismo ajuste fino en cualquiera.

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM posiciones_guardadas WHERE user_id = $1 ORDER BY creado_en DESC',
      [req.userId]
    );
    res.json({ posiciones: resultado.rows });
  } catch (error) {
    console.error('[GET /posiciones]', error);
    res.status(500).json({ error: 'No se pudieron obtener las posiciones guardadas' });
  }
});

router.post('/', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const posX = Number(req.body?.pos_x);
  const posY = Number(req.body?.pos_y);
  const escala = Number.isFinite(Number(req.body?.escala)) ? Number(req.body.escala) : 1;

  if (!nombre) return res.status(400).json({ error: 'Ponele un nombre a la posición' });
  if (!Number.isFinite(posX) || !Number.isFinite(posY)) return res.status(400).json({ error: 'Posición inválida' });

  try {
    const resultado = await pool.query(
      'INSERT INTO posiciones_guardadas (user_id, nombre, pos_x, pos_y, escala) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, nombre, posX, posY, escala]
    );
    res.status(201).json({ posicion: resultado.rows[0] });
  } catch (error) {
    console.error('[POST /posiciones]', error);
    res.status(500).json({ error: 'No se pudo guardar la posición' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM posiciones_guardadas WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (resultado.rowCount === 0) return res.status(404).json({ error: 'Posición no encontrada' });
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /posiciones/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar la posición' });
  }
});

export default router;
