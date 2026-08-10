import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

async function escenaDelUsuario(id, userId) {
  // Ver el mismo guard en routes/equipos.js (equipoDelUsuario) — un id no
  // numérico acá, sin este corte, revienta la query y tira abajo TODO el
  // proceso del backend (promesa sin atrapar, se llama antes del
  // try/catch de cada ruta).
  if (!/^\d+$/.test(String(id))) return null;
  const resultado = await pool.query(
    `SELECT e.* FROM escenas e JOIN partidos p ON p.id = e.partido_id WHERE e.id = $1 AND p.user_id = $2`,
    [id, userId]
  );
  return resultado.rows[0] || null;
}

router.get('/:id', async (req, res) => {
  const escena = await escenaDelUsuario(req.params.id, req.userId);
  if (!escena) return res.status(404).json({ error: 'Escena no encontrada' });
  res.json({ escena });
});

router.put('/:id', async (req, res) => {
  const escena = await escenaDelUsuario(req.params.id, req.userId);
  if (!escena) return res.status(404).json({ error: 'Escena no encontrada' });

  const nombre = req.body?.nombre != null ? String(req.body.nombre).trim() : escena.nombre;
  const activo = req.body?.activo != null ? Boolean(req.body.activo) : escena.activo;
  const config = typeof req.body?.config === 'object' && req.body.config !== null ? req.body.config : escena.config;
  let disenoId = req.body?.diseno_id !== undefined ? req.body.diseno_id : escena.diseno_id;

  if (disenoId) {
    const diseno = await pool.query('SELECT id FROM disenos_guardados WHERE id = $1 AND user_id = $2', [disenoId, req.userId]);
    if (diseno.rows.length === 0) return res.status(404).json({ error: 'Diseño no encontrado' });
  } else {
    disenoId = null;
  }

  try {
    const resultado = await pool.query(
      'UPDATE escenas SET nombre = $1, activo = $2, config = $3::jsonb, diseno_id = $4 WHERE id = $5 RETURNING *',
      [nombre, activo, JSON.stringify(config), disenoId, escena.id]
    );
    const actualizada = resultado.rows[0];
    req.app.locals.io?.to(`escena:${actualizada.public_token}`).emit('escena_actualizada', actualizada);
    res.json({ escena: actualizada });
  } catch (error) {
    console.error('[PUT /escenas/:id]', error);
    res.status(500).json({ error: 'No se pudo actualizar la escena' });
  }
});

router.delete('/:id', async (req, res) => {
  const escena = await escenaDelUsuario(req.params.id, req.userId);
  if (!escena) return res.status(404).json({ error: 'Escena no encontrada' });
  try {
    await pool.query('DELETE FROM escenas WHERE id = $1', [escena.id]);
    req.app.locals.io?.to(`escena:${escena.public_token}`).emit('escena_actualizada', { ...escena, eliminada: true });
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /escenas/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar la escena' });
  }
});

export default router;
