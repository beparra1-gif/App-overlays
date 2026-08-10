import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

async function patrocinadorDelUsuario(id, userId) {
  // Ver el mismo guard en routes/equipos.js (equipoDelUsuario) — un id no
  // numérico acá, sin este corte, revienta la query y tira abajo TODO el
  // proceso del backend (promesa sin atrapar, se llama antes del
  // try/catch de cada ruta).
  if (!/^\d+$/.test(String(id))) return null;
  const resultado = await pool.query('SELECT * FROM patrocinadores WHERE id = $1 AND user_id = $2', [id, userId]);
  return resultado.rows[0] || null;
}

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM patrocinadores WHERE user_id = $1 ORDER BY orden ASC, creado_en ASC', [
      req.userId,
    ]);
    res.json({ patrocinadores: resultado.rows });
  } catch (error) {
    console.error('[GET /patrocinadores]', error);
    res.status(500).json({ error: 'No se pudieron obtener los patrocinadores' });
  }
});

router.post('/', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const imagenUrl = String(req.body?.imagen_url || '').trim();
  const duracionSegundos = Number(req.body?.duracion_segundos) || 8;

  if (!nombre || !imagenUrl) return res.status(400).json({ error: 'Nombre e imagen son obligatorios' });

  try {
    const orden = await pool.query('SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM patrocinadores WHERE user_id = $1', [
      req.userId,
    ]);
    const resultado = await pool.query(
      'INSERT INTO patrocinadores (user_id, nombre, imagen_url, duracion_segundos, orden) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, nombre, imagenUrl, duracionSegundos, orden.rows[0].siguiente]
    );
    res.status(201).json({ patrocinador: resultado.rows[0] });
  } catch (error) {
    console.error('[POST /patrocinadores]', error);
    res.status(500).json({ error: 'No se pudo crear el patrocinador' });
  }
});

router.put('/:id', async (req, res) => {
  const patrocinador = await patrocinadorDelUsuario(req.params.id, req.userId);
  if (!patrocinador) return res.status(404).json({ error: 'Patrocinador no encontrado' });

  const nombre = req.body?.nombre != null ? String(req.body.nombre).trim() : patrocinador.nombre;
  const imagenUrl = req.body?.imagen_url != null ? String(req.body.imagen_url).trim() : patrocinador.imagen_url;
  const activo = req.body?.activo != null ? Boolean(req.body.activo) : patrocinador.activo;
  const orden = req.body?.orden != null ? Number(req.body.orden) : patrocinador.orden;
  const duracionSegundos =
    req.body?.duracion_segundos != null ? Number(req.body.duracion_segundos) : patrocinador.duracion_segundos;

  try {
    const resultado = await pool.query(
      'UPDATE patrocinadores SET nombre = $1, imagen_url = $2, activo = $3, orden = $4, duracion_segundos = $5 WHERE id = $6 RETURNING *',
      [nombre, imagenUrl, activo, orden, duracionSegundos, patrocinador.id]
    );
    res.json({ patrocinador: resultado.rows[0] });
  } catch (error) {
    console.error('[PUT /patrocinadores/:id]', error);
    res.status(500).json({ error: 'No se pudo actualizar el patrocinador' });
  }
});

router.delete('/:id', async (req, res) => {
  const patrocinador = await patrocinadorDelUsuario(req.params.id, req.userId);
  if (!patrocinador) return res.status(404).json({ error: 'Patrocinador no encontrado' });
  try {
    await pool.query('DELETE FROM patrocinadores WHERE id = $1', [patrocinador.id]);
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /patrocinadores/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el patrocinador' });
  }
});

export default router;
