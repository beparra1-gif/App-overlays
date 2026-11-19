import { Router } from 'express';
import multer from 'multer';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { avisarRosterActualizado } from '../socket/rosterBroadcast.js';
import { urlFotoJugador } from '../utils/token.js';
import crypto from 'crypto';

const router = Router();

// Sirve la foto — SIN authenticate: se usa como `src` de una <img> directo
// desde la escena pública (Nómina, disparada en pantalla completa en OBS),
// que no manda ningún token. Mismo criterio que GET /logos/file/:filename.
router.get('/foto/:token', async (req, res) => {
  if (!/^[0-9a-f]{20,64}$/.test(String(req.params.token))) return res.status(404).end();
  try {
    const resultado = await pool.query(
      'SELECT f.mime_type, f.file_data FROM jugador_fotos f JOIN jugadores j ON j.id = f.jugador_id WHERE j.foto_token = $1',
      [req.params.token]
    );
    const foto = resultado.rows[0];
    if (!foto) return res.status(404).end();
    res.setHeader('Content-Type', foto.mime_type);
    // A diferencia de los logos (filename al azar, nunca se pisa — cache
    // "immutable" de un año tiene sentido ahí), la foto de un jugador vive
    // SIEMPRE en la misma URL y se puede reemplazar — un cache largo dejaría
    // la foto vieja pegada en el navegador/OBS. Una hora es un balance
    // razonable: no hay que revalidar en cada jugada, pero un cambio de
    // foto se nota pronto sin tener que versionar la URL.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(foto.file_data);
  } catch (error) {
    console.error('[GET /jugadores/:id/foto]', error);
    res.status(500).end();
  }
});

router.use(authenticate);

// Mismo criterio que en routes/equipos.js: `tiene_foto` (columna barata) se
// traduce a la ruta pública de la imagen, o null si no hay ninguna cargada.
const conFotoUrl = (j) => ({ ...j, fotoUrl: urlFotoJugador(j) });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error('Formato no soportado (usa PNG, JPG o WEBP)'));
    }
    cb(null, true);
  },
});

async function jugadorDelUsuario(jugadorId, userId) {
  // Ver el mismo guard en routes/equipos.js (equipoDelUsuario) — un id no
  // numérico acá, sin este corte, revienta la query y tira abajo TODO el
  // proceso del backend (promesa sin atrapar, se llama antes del
  // try/catch de cada ruta).
  if (!/^\d+$/.test(String(jugadorId))) return null;
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
  if (!nombre && dorsal == null) return res.status(400).json({ error: 'Poné al menos el dorsal o el nombre del jugador' });

  try {
    const resultado = await pool.query(
      'UPDATE jugadores SET nombre = $1, dorsal = $2 WHERE id = $3 RETURNING *',
      [nombre, dorsal, jugador.id]
    );
    if (!jugador.temporal) await avisarRosterActualizado(req.app.locals.io, jugador.equipo_id, req.userId);
    res.json({ jugador: conFotoUrl(resultado.rows[0]) });
  } catch (error) {
    console.error('[PUT /jugadores/:id]', error);
    res.status(500).json({ error: 'No se pudo actualizar el jugador' });
  }
});

router.post('/:id/foto', (req, res) => {
  upload.single('archivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

    const jugador = await jugadorDelUsuario(req.params.id, req.userId);
    if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });

    try {
      await pool.query(
        `INSERT INTO jugador_fotos (jugador_id, mime_type, file_data, actualizado_en)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (jugador_id) DO UPDATE SET mime_type = $2, file_data = $3, actualizado_en = now()`,
        [jugador.id, req.file.mimetype, req.file.buffer]
      );
      // Token nuevo en cada subida: además evita que OBS siga mostrando la foto vieja en caché.
      const actualizado = (await pool.query(
        'UPDATE jugadores SET tiene_foto = true, foto_token = $2 WHERE id = $1 RETURNING *',
        [jugador.id, crypto.randomBytes(16).toString('hex')]
      )).rows[0];
      if (!jugador.temporal) await avisarRosterActualizado(req.app.locals.io, jugador.equipo_id, req.userId);
      res.status(201).json({ tieneFoto: true, fotoUrl: urlFotoJugador(actualizado) });
    } catch (error) {
      console.error('[POST /jugadores/:id/foto]', error);
      res.status(500).json({ error: 'No se pudo guardar la foto' });
    }
  });
});

router.delete('/:id/foto', async (req, res) => {
  const jugador = await jugadorDelUsuario(req.params.id, req.userId);
  if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });

  try {
    await pool.query('DELETE FROM jugador_fotos WHERE jugador_id = $1', [jugador.id]);
    await pool.query('UPDATE jugadores SET tiene_foto = false, foto_token = NULL WHERE id = $1', [jugador.id]);
    if (!jugador.temporal) await avisarRosterActualizado(req.app.locals.io, jugador.equipo_id, req.userId);
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /jugadores/:id/foto]', error);
    res.status(500).json({ error: 'No se pudo borrar la foto' });
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
    // Con "forzar", jugadas y jugadora se borran en UNA sentencia: si falla, no se pierde nada a medias.
    await pool.query(
      forzar
        ? 'WITH ev AS (DELETE FROM eventos_partido WHERE jugador_id = $1) DELETE FROM jugadores WHERE id = $1'
        : 'DELETE FROM jugadores WHERE id = $1',
      [jugador.id]
    );
    if (!jugador.temporal) await avisarRosterActualizado(req.app.locals.io, jugador.equipo_id, req.userId);
    res.status(204).end();
  } catch (error) {
    // 23503 = violación de FK (postgres): el jugador ya tiene jugadas
    // anotadas en algún partido — antes esto era un error genérico sin
    // salida ("no se pudo eliminar"); ahora se le dice al frontend CUÁNTAS,
    // para que pueda ofrecer borrarlas junto con el jugador.
    if (error.code === '23503') {
      const bloqueando = await pool.query('SELECT COUNT(*)::int AS cantidad FROM eventos_partido WHERE jugador_id = $1', [jugador.id]).catch(() => null);
      return res.status(409).json({ error: 'Este jugador tiene jugadas registradas', eventos_bloqueando: bloqueando?.rows[0].cantidad ?? null });
    }
    console.error('[DELETE /jugadores/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el jugador' });
  }
});

export default router;
