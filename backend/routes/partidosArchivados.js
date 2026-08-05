import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, equipo_local_nombre, equipo_visita_nombre, equipo_local_color, equipo_visita_color,
              equipo_local_logo_url, equipo_visita_logo_url, pts_local, pts_visita, jugado_en
       FROM partidos_archivados WHERE user_id = $1 ORDER BY jugado_en DESC`,
      [req.userId]
    );
    res.json({ partidos: resultado.rows });
  } catch (error) {
    console.error('[GET /partidos-archivados]', error);
    res.status(500).json({ error: 'No se pudieron obtener los partidos guardados' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM partidos_archivados WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Partido guardado no encontrado' });
    res.json({ partido: resultado.rows[0] });
  } catch (error) {
    console.error('[GET /partidos-archivados/:id]', error);
    res.status(500).json({ error: 'No se pudo obtener el partido guardado' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM partidos_archivados WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (resultado.rowCount === 0) return res.status(404).json({ error: 'Partido guardado no encontrado' });
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /partidos-archivados/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el partido guardado' });
  }
});

export default router;
