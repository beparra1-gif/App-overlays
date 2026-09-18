import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Una "temporada" acá no es una tabla aparte que el usuario tenga que
// crear y administrar: es, simplemente, todos los PARTIDOS ARCHIVADOS que
// comparten categoría/rama de equipo (ver migración 024 y archivarPartido
// en estadoPartido.js, que graba esa categoría/rama en el momento de
// archivar, sobreviviendo a que el equipo se edite/borre después). Un
// partido "pertenece" a la categoría/rama del equipo LOCAL, con la del
// VISITA como respaldo si el local no tiene una cargada — el caso normal
// (dos equipos de la misma categoría jugando entre sí) da lo mismo por
// cualquiera de los dos lados.
async function partidosDeCategoria(userId, categoria, rama) {
  const catVal = categoria === '' || categoria === undefined ? null : categoria;
  const ramaVal = rama === '' || rama === undefined ? null : rama;
  const resultado = await pool.query(
    `SELECT * FROM partidos_archivados
     WHERE user_id = $1
       AND COALESCE(equipo_local_categoria, equipo_visita_categoria) IS NOT DISTINCT FROM $2
       AND COALESCE(equipo_local_rama, equipo_visita_rama) IS NOT DISTINCT FROM $3
     ORDER BY jugado_en DESC`,
    [userId, catVal, ramaVal]
  );
  return resultado.rows;
}

// GET /api/temporadas — categorías/ramas con al menos un partido
// archivado, para que el usuario elija cuál mirar (no hace falta que
// exista de antemano: aparece sola apenas se archiva el primer partido de
// esa categoría).
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT COALESCE(equipo_local_categoria, equipo_visita_categoria) AS categoria,
              COALESCE(equipo_local_rama, equipo_visita_rama) AS rama,
              COUNT(*)::int AS partidos,
              MAX(jugado_en) AS ultimo_partido
       FROM partidos_archivados
       WHERE user_id = $1
       GROUP BY 1, 2
       ORDER BY ultimo_partido DESC`,
      [req.userId]
    );
    res.json({ temporadas: resultado.rows });
  } catch (error) {
    console.error('[GET /temporadas]', error);
    res.status(500).json({ error: 'No se pudieron obtener las temporadas' });
  }
});

// GET /api/temporadas/tabla?categoria=..&rama=.. — tabla de posiciones:
// victorias/derrotas y puntos a favor/en contra, sumando cada partido
// archivado de esa categoría. Se identifica a cada equipo por su NOMBRE
// (igual que el resto de "partidos archivados", que ya guarda todo
// denormalizado) — si dos equipos distintos comparten nombre exacto
// quedarían mezclados, un caso raro que no vale la pena resolver acá.
router.get('/tabla', async (req, res) => {
  try {
    const partidos = await partidosDeCategoria(req.userId, req.query.categoria, req.query.rama);
    const equipos = new Map();
    const obtenerEquipo = (nombre, color, logoUrl) => {
      if (!equipos.has(nombre)) {
        equipos.set(nombre, {
          nombre, color, logoUrl,
          partidosJugados: 0, victorias: 0, derrotas: 0, puntosAFavor: 0, puntosEnContra: 0,
        });
      }
      return equipos.get(nombre);
    };
    for (const p of partidos) {
      const local = obtenerEquipo(p.equipo_local_nombre, p.equipo_local_color, p.equipo_local_logo_url);
      const visita = obtenerEquipo(p.equipo_visita_nombre, p.equipo_visita_color, p.equipo_visita_logo_url);
      local.partidosJugados += 1;
      visita.partidosJugados += 1;
      local.puntosAFavor += p.pts_local;
      local.puntosEnContra += p.pts_visita;
      visita.puntosAFavor += p.pts_visita;
      visita.puntosEnContra += p.pts_local;
      if (p.pts_local > p.pts_visita) { local.victorias += 1; visita.derrotas += 1; }
      else if (p.pts_visita > p.pts_local) { visita.victorias += 1; local.derrotas += 1; }
    }
    const tabla = Array.from(equipos.values())
      .map((e) => ({ ...e, diferencia: e.puntosAFavor - e.puntosEnContra }))
      .sort((a, b) => b.victorias - a.victorias || b.diferencia - a.diferencia || b.puntosAFavor - a.puntosAFavor);
    res.json({ tabla });
  } catch (error) {
    console.error('[GET /temporadas/tabla]', error);
    res.status(500).json({ error: 'No se pudo calcular la tabla de posiciones' });
  }
});

// GET /api/temporadas/jugadores?categoria=..&rama=.. — estadísticas
// ACUMULADAS de cada jugador a lo largo de todos los partidos archivados
// de la categoría, sumando el `resumen` (foto fija por partido, ya
// calculada por construirEstado al archivar) en vez de recalcular desde
// eventos_partido — más simple y funciona aunque el partido original ya
// se haya reiniciado/borrado. Un jugador que apareció en la nómina pero
// sin ninguna jugada registrada ese partido no suma "partido jugado" (la
// nómina completa se carga siempre, haya jugado o no).
router.get('/jugadores', async (req, res) => {
  try {
    const partidos = await partidosDeCategoria(req.userId, req.query.categoria, req.query.rama);
    const CAMPOS = ['pts', 'reb', 'ast', 'stl', 'to', 'ftm', 'fta', 'fg2m', 'fg3m', 'faltas'];
    const jugadores = new Map();
    const acumular = (roster, equipoNombre) => {
      for (const j of roster || []) {
        const jugo = CAMPOS.some((campo) => (j[campo] || 0) > 0);
        if (!jugo) continue;
        if (!jugadores.has(j.id)) {
          jugadores.set(j.id, {
            id: j.id, nombre: j.nombre, dorsal: j.dorsal, equipoNombre, partidosJugados: 0,
            pts: 0, reb: 0, ast: 0, stl: 0, to: 0, ftm: 0, fta: 0, fg2m: 0, fg3m: 0, faltas: 0,
          });
        }
        const acumulado = jugadores.get(j.id);
        acumulado.partidosJugados += 1;
        for (const campo of CAMPOS) acumulado[campo] += j[campo] || 0;
      }
    };
    // Recorre del más nuevo al más viejo (partidosDeCategoria ya viene en
    // ese orden) — así nombre/dorsal/equipo que queda guardado la primera
    // vez que aparece cada jugador es el más RECIENTE, por si cambió de
    // dorsal o de equipo en el medio de la temporada.
    for (const p of partidos) {
      acumular(p.resumen?.equipoLocal?.roster, p.equipo_local_nombre);
      acumular(p.resumen?.equipoVisita?.roster, p.equipo_visita_nombre);
    }
    const jugadoresOrdenados = Array.from(jugadores.values())
      .map((j) => ({ ...j, promedioPts: j.partidosJugados ? Math.round((j.pts / j.partidosJugados) * 10) / 10 : 0 }))
      .sort((a, b) => b.pts - a.pts);
    res.json({ jugadores: jugadoresOrdenados });
  } catch (error) {
    console.error('[GET /temporadas/jugadores]', error);
    res.status(500).json({ error: 'No se pudieron calcular las estadísticas de temporada' });
  }
});

// GET /api/temporadas/historial?categoria=..&rama=.. — mismos partidos que
// arman la tabla/estadísticas, en formato liviano y orden cronológico
// (más nuevo primero). "Calendario" en esta primera versión es esto:
// quién jugó contra quién, cuándo, con qué resultado — todavía no existe
// en la app el concepto de partido PROGRAMADO a futuro (un partido nace
// recién al abrir "Juego en vivo"), así que esto es historial, no agenda.
router.get('/historial', async (req, res) => {
  try {
    const partidos = await partidosDeCategoria(req.userId, req.query.categoria, req.query.rama);
    const historial = partidos.map((p) => ({
      id: p.id,
      equipoLocalNombre: p.equipo_local_nombre,
      equipoVisitaNombre: p.equipo_visita_nombre,
      equipoLocalColor: p.equipo_local_color,
      equipoVisitaColor: p.equipo_visita_color,
      equipoLocalLogoUrl: p.equipo_local_logo_url,
      equipoVisitaLogoUrl: p.equipo_visita_logo_url,
      ptsLocal: p.pts_local,
      ptsVisita: p.pts_visita,
      jugadoEn: p.jugado_en,
    }));
    res.json({ historial });
  } catch (error) {
    console.error('[GET /temporadas/historial]', error);
    res.status(500).json({ error: 'No se pudo obtener el historial' });
  }
});

export default router;
