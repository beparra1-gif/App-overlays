import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { construirEstado } from '../socket/estadoPartido.js';
import { generarToken } from '../utils/token.js';

const router = Router();
router.use(authenticate);

async function partidoDelUsuario(id, userId) {
  const resultado = await pool.query('SELECT * FROM partidos WHERE id = $1 AND user_id = $2', [id, userId]);
  return resultado.rows[0] || null;
}

// Un diseño no solo define el look del tablero — sus toggles de "Opciones"
// (anunciarJugadas/mostrarNomina/anunciarFaltas/mostrarEstadisticas) deciden
// qué escenas nacen activas para el partido armado con ese diseño. Sin
// diseño (o sin ese toggle definido) todo arranca activo por defecto.
function activoSegunToggle(configDiseno, clave) {
  return configDiseno?.[clave] !== false;
}

async function crearEscenasPorDefecto(partidoId, disenoIdMarcador, configDiseno) {
  const definicion = [
    { tipo: 'marcador', nombre: 'Marcador', disenoId: disenoIdMarcador || null, activo: true, config: {} },
    { tipo: 'nomina', nombre: 'Nómina', disenoId: null, activo: activoSegunToggle(configDiseno, 'mostrarNomina'), config: {} },
    {
      tipo: 'estadisticas',
      nombre: 'Estadísticas',
      disenoId: null,
      activo: activoSegunToggle(configDiseno, 'mostrarEstadisticas'),
      config: { modo: 'equipo', equipo: 'local' },
    },
    {
      tipo: 'anuncios',
      nombre: 'Anuncios',
      disenoId: null,
      activo: activoSegunToggle(configDiseno, 'anunciarJugadas'),
      config: { anunciarFaltas: activoSegunToggle(configDiseno, 'anunciarFaltas') },
    },
  ];

  const filas = [];
  for (const base of definicion) {
    const resultado = await pool.query(
      'INSERT INTO escenas (partido_id, tipo, nombre, diseno_id, config, activo, public_token) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING *',
      [partidoId, base.tipo, base.nombre, base.disenoId, JSON.stringify(base.config), base.activo, generarToken()]
    );
    filas.push(resultado.rows[0]);
  }
  return filas;
}

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT p.*, el.nombre AS equipo_local_nombre, ev.nombre AS equipo_visita_nombre
       FROM partidos p
       JOIN equipos el ON el.id = p.equipo_local_id
       JOIN equipos ev ON ev.id = p.equipo_visita_id
       WHERE p.user_id = $1
       ORDER BY p.creado_en DESC`,
      [req.userId]
    );
    res.json({ partidos: resultado.rows });
  } catch (error) {
    console.error('[GET /partidos]', error);
    res.status(500).json({ error: 'No se pudieron obtener los partidos' });
  }
});

router.post('/', async (req, res) => {
  const equipoLocalId = Number(req.body?.equipo_local_id);
  const equipoVisitaId = Number(req.body?.equipo_visita_id);
  const quintetoLocalIds = Array.isArray(req.body?.quinteto_local_ids) ? req.body.quinteto_local_ids.map(Number) : [];
  const quintetoVisitaIds = Array.isArray(req.body?.quinteto_visita_ids) ? req.body.quinteto_visita_ids.map(Number) : [];
  const disenoIdMarcador = req.body?.diseno_id ? Number(req.body.diseno_id) : null;

  if (!equipoLocalId || !equipoVisitaId || equipoLocalId === equipoVisitaId) {
    return res.status(400).json({ error: 'Selecciona dos equipos distintos' });
  }

  try {
    const equipos = await pool.query('SELECT id FROM equipos WHERE id = ANY($1::int[]) AND user_id = $2', [
      [equipoLocalId, equipoVisitaId],
      req.userId,
    ]);
    if (equipos.rows.length !== 2) return res.status(404).json({ error: 'Alguno de los equipos no existe' });

    let configDiseno = null;
    if (disenoIdMarcador) {
      const diseno = await pool.query('SELECT id, config, partido_activo_id FROM disenos_guardados WHERE id = $1 AND user_id = $2', [disenoIdMarcador, req.userId]);
      if (diseno.rows.length === 0) return res.status(404).json({ error: 'Diseño no encontrado' });
      configDiseno = diseno.rows[0].config;

      // Un diseño ya "activado" para jugar recuerda su partido: volver del
      // catálogo (o de cualquier lado) y reabrir "Juego en vivo" debe
      // retomar el mismo marcador y el mismo enlace de OBS ya cargado, no
      // arrancar uno nuevo de cero cada vez que se reabre la pantalla.
      const partidoActivoId = diseno.rows[0].partido_activo_id;
      if (partidoActivoId) {
        const existente = await partidoDelUsuario(partidoActivoId, req.userId);
        if (existente) {
          const escenasExistentes = await pool.query('SELECT * FROM escenas WHERE partido_id = $1 ORDER BY creado_en ASC', [existente.id]);
          return res.status(200).json({ partido: existente, escenas: escenasExistentes.rows });
        }
      }
    }

    // El diseño define cuántos minutos dura cada período/prórroga (regla real
    // de juego, no solo estética) — se siembra acá tanto la columna (para que
    // "Período siguiente" más adelante sepa a qué resetear) como el reloj
    // inicial del propio partido (en vez de confiar en el DEFAULT de la
    // columna, que sería siempre 10:00 sin importar el diseño elegido).
    const minutosPeriodo = Number(configDiseno?.minutosPeriodo) || 10;
    const minutosProrroga = Number(configDiseno?.minutosProrroga) || 5;

    // Armar equipos (nómina + quinteto) ya pasó a vivir en "Personalizar
    // tablero → Equipos", antes de crear el partido — así que acá ya llega
    // todo resuelto (o a propósito vacío, para juego rápido). Ya no hace
    // falta el estado intermedio "prepartido" pidiendo lo mismo de nuevo en
    // la Mesa: el partido nace directo "en_curso".
    const publicToken = generarToken();
    const resultado = await pool.query(
      `INSERT INTO partidos (user_id, public_token, equipo_local_id, equipo_visita_id, quinteto_local_ids, quinteto_visita_ids, minutos_periodo, minutos_prorroga, reloj_segundos, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'en_curso') RETURNING *`,
      [req.userId, publicToken, equipoLocalId, equipoVisitaId, quintetoLocalIds, quintetoVisitaIds, minutosPeriodo, minutosProrroga, minutosPeriodo * 60]
    );
    const partido = resultado.rows[0];
    const escenas = await crearEscenasPorDefecto(partido.id, disenoIdMarcador, configDiseno);
    if (disenoIdMarcador) {
      await pool.query('UPDATE disenos_guardados SET partido_activo_id = $1 WHERE id = $2', [partido.id, disenoIdMarcador]);
    }
    res.status(201).json({ partido, escenas });
  } catch (error) {
    console.error('[POST /partidos]', error);
    res.status(500).json({ error: 'No se pudo crear el partido' });
  }
});

router.get('/:id', async (req, res) => {
  const partido = await partidoDelUsuario(req.params.id, req.userId);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
  res.json({ partido: await construirEstado(partido) });
});

router.put('/:id/quintetos', async (req, res) => {
  const partido = await partidoDelUsuario(req.params.id, req.userId);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

  const quintetoLocalIds = Array.isArray(req.body?.quinteto_local_ids)
    ? req.body.quinteto_local_ids.map(Number)
    : partido.quinteto_local_ids;
  const quintetoVisitaIds = Array.isArray(req.body?.quinteto_visita_ids)
    ? req.body.quinteto_visita_ids.map(Number)
    : partido.quinteto_visita_ids;

  try {
    const resultado = await pool.query(
      'UPDATE partidos SET quinteto_local_ids = $1, quinteto_visita_ids = $2, actualizado_en = now() WHERE id = $3 RETURNING *',
      [quintetoLocalIds, quintetoVisitaIds, partido.id]
    );
    res.json({ partido: resultado.rows[0] });
  } catch (error) {
    console.error('[PUT /partidos/:id/quintetos]', error);
    res.status(500).json({ error: 'No se pudieron actualizar los quintetos' });
  }
});

router.delete('/:id', async (req, res) => {
  const partido = await partidoDelUsuario(req.params.id, req.userId);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
  try {
    await pool.query('DELETE FROM partidos WHERE id = $1', [partido.id]);
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /partidos/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el partido' });
  }
});

router.get('/:id/escenas', async (req, res) => {
  const partido = await partidoDelUsuario(req.params.id, req.userId);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
  try {
    const resultado = await pool.query('SELECT * FROM escenas WHERE partido_id = $1 ORDER BY creado_en ASC', [partido.id]);
    res.json({ escenas: resultado.rows });
  } catch (error) {
    console.error('[GET /partidos/:id/escenas]', error);
    res.status(500).json({ error: 'No se pudieron obtener las escenas' });
  }
});

const TIPOS_ESCENA_VALIDOS = ['marcador', 'nomina', 'estadisticas', 'anuncios'];

router.post('/:id/escenas', async (req, res) => {
  const partido = await partidoDelUsuario(req.params.id, req.userId);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

  const tipo = String(req.body?.tipo || '').trim();
  const nombre = String(req.body?.nombre || '').trim();
  const disenoId = req.body?.diseno_id ? Number(req.body.diseno_id) : null;
  const config = typeof req.body?.config === 'object' && req.body.config !== null ? req.body.config : {};

  if (!TIPOS_ESCENA_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de escena inválido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre de la escena es obligatorio' });

  if (disenoId) {
    const diseno = await pool.query('SELECT id FROM disenos_guardados WHERE id = $1 AND user_id = $2', [disenoId, req.userId]);
    if (diseno.rows.length === 0) return res.status(404).json({ error: 'Diseño no encontrado' });
  }

  try {
    const resultado = await pool.query(
      'INSERT INTO escenas (partido_id, tipo, nombre, diseno_id, config, public_token) VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING *',
      [partido.id, tipo, nombre, disenoId, JSON.stringify(config), generarToken()]
    );
    res.status(201).json({ escena: resultado.rows[0] });
  } catch (error) {
    console.error('[POST /partidos/:id/escenas]', error);
    res.status(500).json({ error: 'No se pudo crear la escena' });
  }
});

export default router;
