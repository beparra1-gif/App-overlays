import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

async function disenoDelUsuario(id, userId) {
  // Un `id` no numérico en la URL (typo, bot probando rutas, un enlace
  // viejo) pasado tal cual a Postgres (columna integer) revienta la query
  // con una excepción — como esta función se llama siempre ANTES del
  // try/catch de cada ruta, esa excepción quedaba como promesa no
  // atrapada y tiraba abajo el proceso ENTERO del backend (afectaba a
  // todos los usuarios, no solo al pedido con el id inválido). Cortar acá
  // devuelve "no encontrado" — mismo resultado que ya devuelven las rutas
  // para un id inexistente, ninguna ruta necesita cambios.
  if (!/^\d+$/.test(String(id))) return null;
  const resultado = await pool.query('SELECT * FROM disenos_guardados WHERE id = $1 AND user_id = $2', [id, userId]);
  return resultado.rows[0] || null;
}

// Cualquier usuario logueado necesita saber cuáles plantillas sacó el super
// admin del catálogo (ver /admin/plantillas/:id) para no mostrar esas
// tarjetas — de solo lectura, por eso vive acá y no bajo /admin.
router.get('/plantillas-ocultas', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT plantilla_id FROM plantillas_ocultas');
    res.json({ plantillas: resultado.rows.map((r) => r.plantilla_id) });
  } catch (error) {
    console.error('[GET /disenos/plantillas-ocultas]', error);
    res.status(500).json({ error: 'No se pudo obtener el catálogo' });
  }
});

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM disenos_guardados WHERE user_id = $1 ORDER BY creado_en DESC', [req.userId]);
    res.json({ disenos: resultado.rows });
  } catch (error) {
    console.error('[GET /disenos]', error);
    res.status(500).json({ error: 'No se pudieron obtener los diseños' });
  }
});

router.post('/', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const plantillaBase = String(req.body?.plantilla_base || '').trim();
  const config = typeof req.body?.config === 'object' && req.body.config !== null ? req.body.config : {};

  if (!nombre || !plantillaBase) return res.status(400).json({ error: 'Nombre y plantilla base son obligatorios' });

  try {
    // Un usuario tiene a lo sumo un diseño por plantilla (índice único
    // user_id+plantilla_base) — si dos pestañas/clicks intentan crear el de
    // la misma plantilla a la vez, la segunda actualiza la fila existente en
    // vez de duplicarla, así el "un diseño por plantilla" nunca se rompe.
    const resultado = await pool.query(
      `INSERT INTO disenos_guardados (user_id, nombre, plantilla_base, config)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (user_id, plantilla_base) DO UPDATE SET nombre = EXCLUDED.nombre, config = EXCLUDED.config
       RETURNING *`,
      [req.userId, nombre, plantillaBase, JSON.stringify(config)]
    );
    const diseno = resultado.rows[0];
    req.app.locals.io?.to(`diseno:${diseno.id}`).emit('diseno_actualizado', diseno);
    res.status(201).json({ diseno });
  } catch (error) {
    console.error('[POST /disenos]', error);
    res.status(500).json({ error: 'No se pudo guardar el diseño' });
  }
});

router.put('/:id', async (req, res) => {
  const diseno = await disenoDelUsuario(req.params.id, req.userId);
  if (!diseno) return res.status(404).json({ error: 'Diseño no encontrado' });

  const nombre = req.body?.nombre != null ? String(req.body.nombre).trim() : diseno.nombre;
  const plantillaBase = req.body?.plantilla_base != null ? String(req.body.plantilla_base).trim() : diseno.plantilla_base;
  const config = typeof req.body?.config === 'object' && req.body.config !== null ? req.body.config : diseno.config;

  try {
    const resultado = await pool.query(
      'UPDATE disenos_guardados SET nombre = $1, plantilla_base = $2, config = $3::jsonb WHERE id = $4 RETURNING *',
      [nombre, plantillaBase, JSON.stringify(config), diseno.id]
    );
    const actualizado = resultado.rows[0];
    // Empuja el config nuevo a cualquier escena que ya esté abierta en OBS
    // usando este diseño — así los cambios (colores, logo, animaciones,
    // toggles) se ven al instante, aunque el partido ya esté en curso, sin
    // tener que recargar la fuente del navegador en OBS.
    req.app.locals.io?.to(`diseno:${actualizado.id}`).emit('diseno_actualizado', actualizado);
    res.json({ diseno: actualizado });
  } catch (error) {
    console.error('[PUT /disenos/:id]', error);
    res.status(500).json({ error: 'No se pudo actualizar el diseño' });
  }
});

router.delete('/:id', async (req, res) => {
  const diseno = await disenoDelUsuario(req.params.id, req.userId);
  if (!diseno) return res.status(404).json({ error: 'Diseño no encontrado' });
  try {
    await pool.query('DELETE FROM disenos_guardados WHERE id = $1', [diseno.id]);
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /disenos/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el diseño' });
  }
});

export default router;
