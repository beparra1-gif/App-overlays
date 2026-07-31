import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { construirEstado } from '../socket/estadoPartido.js';

const router = Router();
router.use(authenticate);

async function equipoDelUsuario(equipoId, userId) {
  const resultado = await pool.query('SELECT * FROM equipos WHERE id = $1 AND user_id = $2', [equipoId, userId]);
  return resultado.rows[0] || null;
}

// Un equipo puede estar jugando un partido ya en curso — si le cambian el
// nombre, el color o el logo desde "Personalizar tablero", eso tiene que
// verse en la transmisión al instante, sin esperar a la próxima jugada (que
// es lo único que hoy dispara un 'estado' nuevo).
async function avisarPartidosDelEquipo(io, equipoId, userId) {
  if (!io) return;
  const partidos = await pool.query(
    'SELECT * FROM partidos WHERE user_id = $1 AND (equipo_local_id = $2 OR equipo_visita_id = $2)',
    [userId, equipoId]
  );
  for (const partido of partidos.rows) {
    const estado = await construirEstado(partido);
    io.to(`partido:${partido.public_token}`).emit('estado', estado);
  }
}

router.get('/', async (req, res) => {
  try {
    // `en_uso`: es el equipo que ALGÚN diseño tiene puesto ahora mismo como
    // su partido activo (disenos_guardados.partido_activo_id) — la señal
    // más útil para distinguir "el equipo que de verdad estoy usando" de
    // los que quedaron sueltos de pruebas viejas. Van primero en la lista.
    const resultado = await pool.query(
      `SELECT e.*, COUNT(j.id)::int AS jugadores_count,
         EXISTS (
           SELECT 1 FROM disenos_guardados d
           JOIN partidos p ON p.id = d.partido_activo_id
           WHERE d.user_id = e.user_id AND (p.equipo_local_id = e.id OR p.equipo_visita_id = e.id)
         ) AS en_uso
       FROM equipos e
       LEFT JOIN jugadores j ON j.equipo_id = e.id
       WHERE e.user_id = $1
       GROUP BY e.id
       ORDER BY en_uso DESC, e.nombre ASC`,
      [req.userId]
    );
    res.json({ equipos: resultado.rows });
  } catch (error) {
    console.error('[GET /equipos]', error);
    res.status(500).json({ error: 'No se pudieron obtener los equipos' });
  }
});

router.post('/', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const color = String(req.body?.color || '#0a84ff').trim();
  const logoUrl = req.body?.logo_url ? String(req.body.logo_url).trim() : null;

  if (!nombre) return res.status(400).json({ error: 'El nombre del equipo es obligatorio' });

  try {
    const resultado = await pool.query(
      'INSERT INTO equipos (user_id, nombre, color, logo_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, nombre, color, logoUrl]
    );
    res.status(201).json({ equipo: resultado.rows[0] });
  } catch (error) {
    console.error('[POST /equipos]', error);
    res.status(500).json({ error: 'No se pudo crear el equipo' });
  }
});

router.put('/:id', async (req, res) => {
  const equipo = await equipoDelUsuario(req.params.id, req.userId);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const nombre = req.body?.nombre != null ? String(req.body.nombre).trim() : equipo.nombre;
  const color = req.body?.color != null ? String(req.body.color).trim() : equipo.color;
  const logoUrl = req.body?.logo_url != null ? String(req.body.logo_url).trim() : equipo.logo_url;

  try {
    const resultado = await pool.query(
      'UPDATE equipos SET nombre = $1, color = $2, logo_url = $3 WHERE id = $4 RETURNING *',
      [nombre, color, logoUrl, equipo.id]
    );
    await avisarPartidosDelEquipo(req.app.locals.io, equipo.id, req.userId);
    res.json({ equipo: resultado.rows[0] });
  } catch (error) {
    console.error('[PUT /equipos/:id]', error);
    res.status(500).json({ error: 'No se pudo actualizar el equipo' });
  }
});

router.delete('/:id', async (req, res) => {
  const equipo = await equipoDelUsuario(req.params.id, req.userId);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  // `?forzar=true`: el usuario ya vio cuántos partidos bloqueaban el borrado
  // (ver el catch de abajo) y confirmó que quiere borrarlos también — los
  // partidos de prueba/terminados que ya nadie necesita se van con el
  // equipo, nunca solos y nunca sin ese paso previo. Las escenas/eventos de
  // esos partidos se van solos (ON DELETE CASCADE).
  const forzar = req.query.forzar === 'true';

  try {
    if (forzar) {
      await pool.query('DELETE FROM partidos WHERE user_id = $1 AND (equipo_local_id = $2 OR equipo_visita_id = $2)', [req.userId, equipo.id]);
    }
    await pool.query('DELETE FROM equipos WHERE id = $1', [equipo.id]);
    res.status(204).end();
  } catch (error) {
    // 23503 = violación de FK (postgres): el equipo todavía tiene partidos
    // asociados — en vez de un error genérico, se le dice al frontend
    // CUÁNTOS, para que pueda ofrecer borrarlos junto con el equipo.
    if (error.code === '23503') {
      const bloqueando = await pool.query(
        'SELECT COUNT(*)::int AS cantidad FROM partidos WHERE user_id = $1 AND (equipo_local_id = $2 OR equipo_visita_id = $2)',
        [req.userId, equipo.id]
      );
      return res.status(409).json({ error: 'Este equipo tiene partidos asociados', partidos_bloqueando: bloqueando.rows[0].cantidad });
    }
    console.error('[DELETE /equipos/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el equipo' });
  }
});

router.get('/:id/jugadores', async (req, res) => {
  const equipo = await equipoDelUsuario(req.params.id, req.userId);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  try {
    const resultado = await pool.query(
      'SELECT * FROM jugadores WHERE equipo_id = $1 ORDER BY dorsal ASC NULLS LAST, nombre ASC',
      [equipo.id]
    );
    res.json({ jugadores: resultado.rows });
  } catch (error) {
    console.error('[GET /equipos/:id/jugadores]', error);
    res.status(500).json({ error: 'No se pudieron obtener los jugadores' });
  }
});

router.post('/:id/jugadores', async (req, res) => {
  const equipo = await equipoDelUsuario(req.params.id, req.userId);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const nombre = String(req.body?.nombre || '').trim();
  const dorsalRaw = req.body?.dorsal;
  const dorsal = dorsalRaw != null && dorsalRaw !== '' ? Number(dorsalRaw) : null;

  if (!nombre) return res.status(400).json({ error: 'El nombre del jugador es obligatorio' });
  if (dorsal != null && !Number.isFinite(dorsal)) return res.status(400).json({ error: 'Dorsal inválido' });

  try {
    const resultado = await pool.query(
      'INSERT INTO jugadores (equipo_id, dorsal, nombre) VALUES ($1, $2, $3) RETURNING *',
      [equipo.id, dorsal, nombre]
    );
    res.status(201).json({ jugador: resultado.rows[0] });
  } catch (error) {
    console.error('[POST /equipos/:id/jugadores]', error);
    res.status(500).json({ error: 'No se pudo agregar el jugador' });
  }
});

export default router;
