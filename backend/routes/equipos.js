import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { construirEstado } from '../socket/estadoPartido.js';
import { avisarRosterActualizado } from '../socket/rosterBroadcast.js';

const router = Router();
router.use(authenticate);

async function equipoDelUsuario(equipoId, userId) {
  // Un `id` no numérico en la URL (typo, bot probando rutas, un enlace
  // viejo, o — como pasó de verdad probando el reinicio de partido con un
  // equipo aún sin resolver — un "undefined" que se coló en el payload)
  // pasado tal cual a Postgres (columna integer) revienta la query con una
  // excepción. Como esta función se llama siempre ANTES del try/catch de
  // cada ruta, esa excepción quedaba como promesa no atrapada y tiraba
  // abajo el proceso ENTERO del backend — afectaba a TODOS los usuarios,
  // no solo al pedido con el id inválido. Cortar acá devuelve "no
  // encontrado", mismo resultado que ya devuelven las rutas para un id
  // inexistente — ninguna ruta necesita cambios propios.
  if (!/^\d+$/.test(String(equipoId))) return null;
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

// "Local"/"Visita" son los nombres por defecto de un partido rápido (ver
// EquipoFicha.jsx) — si nunca se tocó ese campo, el equipo que se crea
// acá arranca como BORRADOR (no aparece en la lista de Equipos, aunque
// sigue funcionando igual para jugar). Deja de serlo apenas el usuario lo
// edita de verdad: le cambia el nombre (PUT /:id, más abajo) o le carga un
// jugador (POST /:id/jugadores) — cualquiera de las dos es una señal clara
// de que ya no es descartable.
const NOMBRES_PLACEHOLDER = ['Local', 'Visita'];
// Categoría (Sub-15, Primera, etc.) es texto libre — cada liga/club usa las
// suyas. Rama sí queda cerrada a estas dos: son datos propios del equipo,
// solo para organizarlo en "Equipos" (chips en la tarjeta) — nunca se
// muestran en los selectores de "elegir equipo" de la Mesa/reinicio, que
// siguen mostrando nada más que el nombre.
const RAMAS_VALIDAS = ['femenino', 'masculino'];
const limpiarRama = (valor) => {
  const r = String(valor || '').trim().toLowerCase();
  return RAMAS_VALIDAS.includes(r) ? r : null;
};

router.post('/', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const color = String(req.body?.color || '#0a84ff').trim();
  const logoUrl = req.body?.logo_url ? String(req.body.logo_url).trim() : null;
  const categoria = req.body?.categoria ? String(req.body.categoria).trim() : null;
  const rama = limpiarRama(req.body?.rama);
  const borrador = NOMBRES_PLACEHOLDER.includes(nombre);

  if (!nombre) return res.status(400).json({ error: 'El nombre del equipo es obligatorio' });

  try {
    const resultado = await pool.query(
      'INSERT INTO equipos (user_id, nombre, color, logo_url, categoria, rama, borrador) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.userId, nombre, color, logoUrl, categoria, rama, borrador]
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
  const categoria = req.body?.categoria != null ? (String(req.body.categoria).trim() || null) : equipo.categoria;
  const rama = req.body?.rama !== undefined ? limpiarRama(req.body.rama) : equipo.rama;
  // Un borrador deja de serlo apenas se le pone un nombre de verdad —
  // nunca al revés: si ya era un equipo real, renombrarlo a "Local" (poco
  // probable, pero por las dudas) no lo vuelve a esconder.
  const borrador = equipo.borrador && NOMBRES_PLACEHOLDER.includes(nombre);

  try {
    const resultado = await pool.query(
      'UPDATE equipos SET nombre = $1, color = $2, logo_url = $3, categoria = $4, rama = $5, borrador = $6 WHERE id = $7 RETURNING *',
      [nombre, color, logoUrl, categoria, rama, borrador, equipo.id]
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

// Solo el plantel PERMANENTE (temporal = false) — este es "la nómina
// guardada del equipo", la que se reusa automáticamente en cualquier
// partido futuro. Un jugador "solo para este partido" (ver POST más abajo)
// nunca aparece acá, para no ensuciar el plantel de siempre — sí aparece,
// mientras dure ESE partido puntual, en el roster que arma
// cargarRoster()/construirEstado (backend/socket/estadoPartido.js), que
// filtra distinto (por partido, no por equipo).
router.get('/:id/jugadores', async (req, res) => {
  const equipo = await equipoDelUsuario(req.params.id, req.userId);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  try {
    const resultado = await pool.query(
      'SELECT * FROM jugadores WHERE equipo_id = $1 AND temporal = false ORDER BY dorsal ASC NULLS LAST, nombre ASC',
      [equipo.id]
    );
    res.json({ jugadores: resultado.rows });
  } catch (error) {
    console.error('[GET /equipos/:id/jugadores]', error);
    res.status(500).json({ error: 'No se pudieron obtener los jugadores' });
  }
});

// `temporal` + `partido_id` (opcionales): un jugador "solo para este
// partido" (invitado, suplente de una fecha puntual) — queda guardado
// igual que cualquier otro (mismas jugadas/estadísticas, mismo jugador_id
// en eventos_partido), pero NUNCA aparece en el plantel reusable del
// equipo (GET de acá arriba) ni en partidos futuros — solo en el que se
// indica. `partido_id` tiene que ser un partido real del usuario donde
// juega este equipo — si no, se ignora el pedido de "temporal" (se guarda
// como jugador normal) en vez de fallar silenciosamente con un jugador
// temporal que no aparecería en ningún lado.
router.post('/:id/jugadores', async (req, res) => {
  const equipo = await equipoDelUsuario(req.params.id, req.userId);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const nombre = String(req.body?.nombre || '').trim();
  const dorsalRaw = req.body?.dorsal;
  const dorsal = dorsalRaw != null && dorsalRaw !== '' ? Number(dorsalRaw) : null;
  let partidoId = req.body?.temporal && req.body?.partido_id ? Number(req.body.partido_id) : null;

  // A veces se carga la nómina antes de saber el nombre real de cada
  // jugadora (llega una planilla con solo dorsales, por ejemplo) — con el
  // dorsal alcanza para identificarla en cancha; el nombre se puede
  // completar después con "Editar". Lo único que de verdad no puede
  // faltar es AL MENOS uno de los dos (si no, no hay forma de saber de
  // quién se trata).
  if (!nombre && dorsal == null) return res.status(400).json({ error: 'Poné al menos el dorsal o el nombre del jugador' });
  if (dorsal != null && !Number.isFinite(dorsal)) return res.status(400).json({ error: 'Dorsal inválido' });

  if (partidoId) {
    const partido = await pool.query(
      'SELECT id FROM partidos WHERE id = $1 AND user_id = $2 AND (equipo_local_id = $3 OR equipo_visita_id = $3)',
      [partidoId, req.userId, equipo.id]
    );
    if (partido.rows.length === 0) partidoId = null;
  }
  const temporal = Boolean(partidoId);

  try {
    const resultado = await pool.query(
      'INSERT INTO jugadores (equipo_id, dorsal, nombre, temporal, partido_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [equipo.id, dorsal, nombre, temporal, partidoId]
    );
    // Cargar una nómina (aunque sea de un solo jugador) es tan "guardar el
    // equipo de verdad" como renombrarlo — si todavía era borrador, deja
    // de serlo.
    if (equipo.borrador) await pool.query('UPDATE equipos SET borrador = false WHERE id = $1', [equipo.id]);
    if (!temporal) await avisarRosterActualizado(req.app.locals.io, equipo.id, req.userId);
    res.status(201).json({ jugador: resultado.rows[0] });
  } catch (error) {
    console.error('[POST /equipos/:id/jugadores]', error);
    res.status(500).json({ error: 'No se pudo agregar el jugador' });
  }
});

// "Elegir nómina de los equipos guardados" (EquipoFicha.jsx): en vez de
// tipear de nuevo un plantel que ya está cargado en OTRO equipo guardado
// (el mismo club, una categoría/rama distinta, por ejemplo), se copia acá
// — cada jugador copiado queda como una fila NUEVA, propia de este equipo
// (mismo dorsal/nombre, sin arrastrar jugadas ni estadísticas del equipo de
// origen), así que de acá en más se edita totalmente independiente del
// plantel que se copió.
router.post('/:id/copiar-nomina', async (req, res) => {
  const equipo = await equipoDelUsuario(req.params.id, req.userId);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const origen = await equipoDelUsuario(req.body?.desde_equipo_id, req.userId);
  if (!origen) return res.status(404).json({ error: 'El equipo de origen no existe' });
  if (origen.id === equipo.id) return res.status(400).json({ error: 'Elegí un equipo distinto para copiar la nómina' });

  try {
    const resultado = await pool.query(
      `INSERT INTO jugadores (equipo_id, dorsal, nombre, temporal, partido_id)
       SELECT $1, dorsal, nombre, false, NULL FROM jugadores WHERE equipo_id = $2 AND temporal = false
       RETURNING *`,
      [equipo.id, origen.id]
    );
    if (resultado.rows.length === 0) return res.status(400).json({ error: 'Ese equipo todavía no tiene nómina cargada' });
    if (equipo.borrador) await pool.query('UPDATE equipos SET borrador = false WHERE id = $1', [equipo.id]);
    await avisarRosterActualizado(req.app.locals.io, equipo.id, req.userId);
    res.status(201).json({ jugadores: resultado.rows });
  } catch (error) {
    console.error('[POST /equipos/:id/copiar-nomina]', error);
    res.status(500).json({ error: 'No se pudo copiar la nómina' });
  }
});

export default router;
