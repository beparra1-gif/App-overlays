import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Plantillas armadas a mano en el Creador de marcador y guardadas para
// reusar (ver el comentario en la migración 023) — listadas junto a las 34
// de fábrica en el catálogo de "Diseños", filtradas por usuario (cada una
// es privada de quien la armó, no un catálogo compartido).
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM plantillas_personalizadas WHERE user_id = $1 ORDER BY creado_en DESC',
      [req.userId]
    );
    res.json({ plantillas: resultado.rows });
  } catch (error) {
    console.error('[GET /plantillas-personalizadas]', error);
    res.status(500).json({ error: 'No se pudieron obtener las plantillas guardadas' });
  }
});

router.post('/', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const plantillaBase = String(req.body?.plantilla_base || 'creador-libre').trim();
  const config = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};

  if (!nombre) return res.status(400).json({ error: 'Ponele un nombre a la plantilla' });

  try {
    const resultado = await pool.query(
      'INSERT INTO plantillas_personalizadas (user_id, nombre, plantilla_base, config) VALUES ($1, $2, $3, $4::jsonb) RETURNING *',
      [req.userId, nombre, plantillaBase, JSON.stringify(config)]
    );
    res.status(201).json({ plantilla: resultado.rows[0] });
  } catch (error) {
    console.error('[POST /plantillas-personalizadas]', error);
    res.status(500).json({ error: 'No se pudo guardar la plantilla' });
  }
});

router.put('/:id', async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) return res.status(404).json({ error: 'Plantilla no encontrada' });
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'Ponele un nombre a la plantilla' });

  try {
    const resultado = await pool.query(
      'UPDATE plantillas_personalizadas SET nombre = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [nombre, req.params.id, req.userId]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json({ plantilla: resultado.rows[0] });
  } catch (error) {
    console.error('[PUT /plantillas-personalizadas/:id]', error);
    res.status(500).json({ error: 'No se pudo renombrar la plantilla' });
  }
});

router.delete('/:id', async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) return res.status(404).json({ error: 'Plantilla no encontrada' });
  try {
    const resultado = await pool.query(
      'DELETE FROM plantillas_personalizadas WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /plantillas-personalizadas/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar la plantilla' });
  }
});

export default router;
