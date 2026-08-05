import pool from '../db.js';

export function relojActual(partido) {
  if (!partido.reloj_corriendo || !partido.reloj_referencia_en) return partido.reloj_segundos;
  const transcurrido = Math.floor((Date.now() - new Date(partido.reloj_referencia_en).getTime()) / 1000);
  return Math.max(0, partido.reloj_segundos - transcurrido);
}

function esDescalificado(j) {
  return j.faltasPersonales >= 5 || j.faltasTecnicas >= 2 || j.faltasAntideportivas >= 2 || j.faltasDescalificantes >= 1;
}

function totalesEquipo(roster) {
  return roster.reduce(
    (acc, j) => ({
      pts: acc.pts + j.pts,
      reb: acc.reb + j.reb,
      ast: acc.ast + j.ast,
      stl: acc.stl + j.stl,
      to: acc.to + j.to,
      faltas: acc.faltas + j.faltas,
    }),
    { pts: 0, reb: 0, ast: 0, stl: 0, to: 0, faltas: 0 }
  );
}

// `convocadosIds` (opcional): si el partido tiene una lista de convocados
// para este equipo (Mesa de control → "Elegir convocados", máx. 12
// sugerido), el roster que se usa para JUGAR queda restringido a esa
// lista — el plantel guardado del equipo (jugadores.equipo_id) sigue
// intacto, esto no borra ni desengancha a nadie, solo decide quién
// aparece acá para anotarle jugadas hoy. Array vacío = sin restricción
// (todo el plantel juega), el comportamiento de siempre.
async function cargarRoster(equipoId, partidoId, minutosPorJugador = new Map(), convocadosIds = []) {
  const resultado = await pool.query(
    `SELECT j.id, j.dorsal, j.nombre,
       COALESCE(SUM(CASE WHEN e.tipo = 'PUNTO' THEN e.puntos ELSE 0 END), 0)::int AS pts,
       COALESCE(SUM(CASE WHEN e.tipo = 'REBOTE' THEN 1 ELSE 0 END), 0)::int AS reb,
       COALESCE(SUM(CASE WHEN e.tipo = 'ASISTENCIA' THEN 1 ELSE 0 END), 0)::int AS ast,
       COALESCE(SUM(CASE WHEN e.tipo = 'ROBO' THEN 1 ELSE 0 END), 0)::int AS stl,
       COALESCE(SUM(CASE WHEN e.tipo = 'PERDIDA' THEN 1 ELSE 0 END), 0)::int AS "to",
       COALESCE(SUM(CASE WHEN e.tipo = 'TIRO_LIBRE' THEN (e.metadata->>'convertidos')::int ELSE 0 END), 0)::int AS ftm,
       COALESCE(SUM(CASE WHEN e.tipo = 'TIRO_LIBRE' THEN (e.metadata->>'intentos')::int ELSE 0 END), 0)::int AS fta,
       COALESCE(SUM(CASE WHEN e.tipo = 'PUNTO' AND e.puntos = 2 THEN 1 ELSE 0 END), 0)::int AS fg2m,
       COALESCE(SUM(CASE WHEN e.tipo = 'PUNTO' AND e.puntos = 3 THEN 1 ELSE 0 END), 0)::int AS fg3m,
       COALESCE(SUM(CASE WHEN e.tipo = 'FALTA' AND COALESCE(e.metadata->>'tipoFalta', 'personal') = 'personal' THEN 1 ELSE 0 END), 0)::int AS faltas_personales,
       COALESCE(SUM(CASE WHEN e.tipo = 'FALTA' AND e.metadata->>'tipoFalta' = 'tecnica' THEN 1 ELSE 0 END), 0)::int AS faltas_tecnicas,
       COALESCE(SUM(CASE WHEN e.tipo = 'FALTA' AND e.metadata->>'tipoFalta' = 'antideportiva' THEN 1 ELSE 0 END), 0)::int AS faltas_antideportivas,
       COALESCE(SUM(CASE WHEN e.tipo = 'FALTA' AND e.metadata->>'tipoFalta' = 'descalificante' THEN 1 ELSE 0 END), 0)::int AS faltas_descalificantes,
       COALESCE(SUM(CASE WHEN e.tipo = 'FALTA' THEN 1 ELSE 0 END), 0)::int AS faltas
     FROM jugadores j
     LEFT JOIN eventos_partido e ON e.jugador_id = j.id AND e.partido_id = $2
     WHERE j.equipo_id = $1 AND (j.temporal = false OR j.partido_id = $2)
       AND (COALESCE(array_length($3::int[], 1), 0) = 0 OR j.id = ANY($3::int[]))
     GROUP BY j.id
     ORDER BY j.dorsal ASC NULLS LAST, j.nombre ASC`,
    [equipoId, partidoId, convocadosIds]
  );

  return resultado.rows.map((j) => {
    const jugador = {
      id: j.id,
      dorsal: j.dorsal,
      nombre: j.nombre,
      pts: j.pts,
      reb: j.reb,
      ast: j.ast,
      stl: j.stl,
      to: j.to,
      ftm: j.ftm,
      fta: j.fta,
      fg2m: j.fg2m,
      fg3m: j.fg3m,
      faltas: j.faltas,
      faltasPersonales: j.faltas_personales,
      faltasTecnicas: j.faltas_tecnicas,
      faltasAntideportivas: j.faltas_antideportivas,
      faltasDescalificantes: j.faltas_descalificantes,
      segundosJugados: minutosPorJugador.get(j.id) || 0,
    };
    return { ...jugador, descalificado: esDescalificado(jugador) };
  });
}

export async function cargarPartidoPorToken(publicToken) {
  const resultado = await pool.query('SELECT * FROM partidos WHERE public_token = $1', [publicToken]);
  return resultado.rows[0] || null;
}

export async function cargarPartidoPorId(id) {
  const resultado = await pool.query('SELECT * FROM partidos WHERE id = $1', [id]);
  return resultado.rows[0] || null;
}

// Busca un logo "de fondo" (categoria='fondo') que tenga el MISMO nombre
// que el logo normal ya asignado al equipo — así un club con dos versiones
// de su escudo (color + blanco y negro, p. ej.) no necesita elegir nada a
// mano por diseño: el emparejamiento es automático, por nombre, cada vez
// que se arma el estado del partido. `logoUrl` es la URL completa ya
// guardada en `equipos.logo_url` (la arma el frontend con urlLogo(),
// termina en `/logos/file/<filename>`) — para no necesitar saber acá la
// URL base del backend, se reusa la MISMA URL cambiándole nada más el
// nombre de archivo del final.
async function logoFondoPara(logoUrl, userId) {
  if (!logoUrl) return null;
  const filename = logoUrl.split('/').pop();
  if (!filename) return null;
  const resultado = await pool.query(
    `SELECT l2.filename FROM logos l1
     JOIN logos l2 ON l2.nombre = l1.nombre AND l2.user_id = l1.user_id AND l2.categoria = 'fondo'
     WHERE l1.filename = $1 AND l1.user_id = $2
     LIMIT 1`,
    [filename, userId]
  );
  if (resultado.rows.length === 0) return null;
  return logoUrl.replace(/[^/]+$/, resultado.rows[0].filename);
}

export async function construirEstado(partido) {
  const minutosPorJugador = await minutosJugados(partido);
  const [equipoLocal, equipoVisita] = await Promise.all([
    pool.query('SELECT id, nombre, color, logo_url FROM equipos WHERE id = $1', [partido.equipo_local_id]),
    pool.query('SELECT id, nombre, color, logo_url FROM equipos WHERE id = $1', [partido.equipo_visita_id]),
  ]);

  const [rosterLocal, rosterVisita, patrocinadores, logoFondoLocal, logoFondoVisita] = await Promise.all([
    cargarRoster(partido.equipo_local_id, partido.id, minutosPorJugador, partido.convocados_local_ids),
    cargarRoster(partido.equipo_visita_id, partido.id, minutosPorJugador, partido.convocados_visita_ids),
    pool.query(
      'SELECT id, nombre, imagen_url, duracion_segundos FROM patrocinadores WHERE user_id = $1 AND activo = true ORDER BY orden ASC',
      [partido.user_id]
    ),
    logoFondoPara(equipoLocal.rows[0]?.logo_url, partido.user_id),
    logoFondoPara(equipoVisita.rows[0]?.logo_url, partido.user_id),
  ]);

  return {
    id: partido.id,
    publicToken: partido.public_token,
    estado: partido.estado,
    periodo: partido.periodo,
    relojSegundos: relojActual(partido),
    relojCorriendo: partido.reloj_corriendo,
    minutosPeriodo: partido.minutos_periodo,
    minutosProrroga: partido.minutos_prorroga,
    ptsLocal: partido.pts_local,
    ptsVisita: partido.pts_visita,
    faltasLocal: partido.faltas_local,
    faltasVisita: partido.faltas_visita,
    faltasPeriodoLocal: partido.faltas_periodo_local,
    faltasPeriodoVisita: partido.faltas_periodo_visita,
    bonusLocal: partido.faltas_periodo_local >= 5,
    bonusVisita: partido.faltas_periodo_visita >= 5,
    timeoutsLocal: partido.timeouts_local,
    timeoutsVisita: partido.timeouts_visita,
    posesion: partido.posesion,
    quintetoLocalIds: partido.quinteto_local_ids,
    quintetoVisitaIds: partido.quinteto_visita_ids,
    convocadosLocalIds: partido.convocados_local_ids,
    convocadosVisitaIds: partido.convocados_visita_ids,
    equipoLocal: { ...equipoLocal.rows[0], roster: rosterLocal, totales: totalesEquipo(rosterLocal), logoFondoUrl: logoFondoLocal },
    equipoVisita: { ...equipoVisita.rows[0], roster: rosterVisita, totales: totalesEquipo(rosterVisita), logoFondoUrl: logoFondoVisita },
    patrocinadores: patrocinadores.rows,
  };
}

// A diferencia de registrarPunto (que suma), esto FIJA el marcador a un
// valor exacto — para corregir un error de carga sin tener que deshacer
// jugada por jugada. No genera un evento de jugada (no debe anunciarse
// como una acción de juego), pero sí queda registrado en eventos_partido
// para tener rastro de auditoría.
export async function corregirPuntos(partido, { equipo, puntos }) {
  const campo = equipo === 'local' ? 'pts_local' : 'pts_visita';
  const resultado = await pool.query(
    `UPDATE partidos SET ${campo} = $1, actualizado_en = now() WHERE id = $2 RETURNING *`,
    [puntos, partido.id]
  );
  await pool.query(
    'INSERT INTO eventos_partido (partido_id, tipo, equipo, detalle, periodo, reloj_segundos_evento) VALUES ($1, $2, $3, $4, $5, $6)',
    [partido.id, 'CORRECCION_MARCADOR', equipo, `Marcador corregido a ${puntos}`, partido.periodo, relojActual(partido)]
  );
  return resultado.rows[0];
}

export async function registrarPunto(partido, { equipo, jugadorId, puntos }) {
  const campo = equipo === 'local' ? 'pts_local' : 'pts_visita';
  const resultado = await pool.query(
    `UPDATE partidos SET ${campo} = ${campo} + $1, actualizado_en = now() WHERE id = $2 RETURNING *`,
    [puntos, partido.id]
  );
  await pool.query(
    'INSERT INTO eventos_partido (partido_id, tipo, jugador_id, equipo, puntos, periodo, reloj_segundos_evento) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [partido.id, 'PUNTO', jugadorId || null, equipo, puntos, partido.periodo, relojActual(partido)]
  );
  return resultado.rows[0];
}

export async function registrarTiroLibre(partido, { equipo, jugadorId, convertidos, intentos }) {
  const campo = equipo === 'local' ? 'pts_local' : 'pts_visita';
  const resultado = await pool.query(
    `UPDATE partidos SET ${campo} = ${campo} + $1, actualizado_en = now() WHERE id = $2 RETURNING *`,
    [convertidos, partido.id]
  );
  await pool.query(
    `INSERT INTO eventos_partido (partido_id, tipo, jugador_id, equipo, puntos, metadata, periodo, reloj_segundos_evento) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [partido.id, 'TIRO_LIBRE', jugadorId || null, equipo, convertidos, JSON.stringify({ convertidos, intentos }), partido.periodo, relojActual(partido)]
  );
  return resultado.rows[0];
}

// Puntos anotados por cuarto/prórroga, por equipo — se arma sumando los
// eventos de puntaje (PUNTO/TIRO_LIBRE) agrupados por el período en el que
// pasaron. Solo cuenta jugadas reales: una corrección manual del marcador
// (PUNTOS_CORREGIR) no queda reflejada acá, a propósito — es un ajuste
// puntual, no una jugada de un cuarto en particular.
export async function puntosPorPeriodo(partidoId) {
  const resultado = await pool.query(
    `SELECT periodo, equipo, COALESCE(SUM(puntos), 0)::int AS puntos
     FROM eventos_partido
     WHERE partido_id = $1 AND tipo IN ('PUNTO', 'TIRO_LIBRE') AND periodo IS NOT NULL
     GROUP BY periodo, equipo
     ORDER BY periodo ASC`,
    [partidoId]
  );
  const porPeriodo = new Map();
  for (const fila of resultado.rows) {
    if (!porPeriodo.has(fila.periodo)) porPeriodo.set(fila.periodo, { periodo: fila.periodo, local: 0, visita: 0 });
    porPeriodo.get(fila.periodo)[fila.equipo] = fila.puntos;
  }
  return Array.from(porPeriodo.values());
}

export async function registrarFalta(partido, { equipo, jugadorId, tipoFalta = 'personal' }) {
  const campo = equipo === 'local' ? 'faltas_local' : 'faltas_visita';
  const campoPeriodo = equipo === 'local' ? 'faltas_periodo_local' : 'faltas_periodo_visita';
  const resultado = await pool.query(
    `UPDATE partidos SET ${campo} = ${campo} + 1, ${campoPeriodo} = ${campoPeriodo} + 1, actualizado_en = now() WHERE id = $1 RETURNING *`,
    [partido.id]
  );
  await pool.query(
    `INSERT INTO eventos_partido (partido_id, tipo, jugador_id, equipo, metadata, periodo, reloj_segundos_evento) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [partido.id, 'FALTA', jugadorId || null, equipo, JSON.stringify({ tipoFalta }), partido.periodo, relojActual(partido)]
  );
  return resultado.rows[0];
}

async function registrarEventoSimple(partido, tipo, { equipo, jugadorId }) {
  await pool.query(
    'INSERT INTO eventos_partido (partido_id, tipo, jugador_id, equipo, periodo, reloj_segundos_evento) VALUES ($1, $2, $3, $4, $5, $6)',
    [partido.id, tipo, jugadorId || null, equipo, partido.periodo, relojActual(partido)]
  );
  return partido;
}

export const registrarRebote = (partido, payload) => registrarEventoSimple(partido, 'REBOTE', payload);
export const registrarAsistencia = (partido, payload) => registrarEventoSimple(partido, 'ASISTENCIA', payload);
export const registrarRobo = (partido, payload) => registrarEventoSimple(partido, 'ROBO', payload);
export const registrarPerdida = (partido, payload) => registrarEventoSimple(partido, 'PERDIDA', payload);

export async function registrarSustitucion(partido, { equipo, jugadorSaleId, jugadorEntraId }) {
  const campo = equipo === 'local' ? 'quinteto_local_ids' : 'quinteto_visita_ids';
  const actual = equipo === 'local' ? partido.quinteto_local_ids : partido.quinteto_visita_ids;
  const nuevo = actual.map((id) => (id === jugadorSaleId ? jugadorEntraId : id));
  const resultado = await pool.query(`UPDATE partidos SET ${campo} = $1, actualizado_en = now() WHERE id = $2 RETURNING *`, [
    nuevo,
    partido.id,
  ]);
  await pool.query(
    `INSERT INTO eventos_partido (partido_id, tipo, equipo, metadata, periodo, reloj_segundos_evento) VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
    [partido.id, 'SUSTITUCION', equipo, JSON.stringify({ jugadorSaleId, jugadorEntraId }), partido.periodo, relojActual(partido)]
  );
  return resultado.rows[0];
}

export async function usarTimeout(partido, equipo) {
  const actual = equipo === 'local' ? partido.timeouts_local : partido.timeouts_visita;
  if (actual <= 0) return partido;
  const campo = equipo === 'local' ? 'timeouts_local' : 'timeouts_visita';
  const resultado = await pool.query(
    `UPDATE partidos SET ${campo} = ${campo} - 1, actualizado_en = now() WHERE id = $1 RETURNING *`,
    [partido.id]
  );
  await pool.query(
    'INSERT INTO eventos_partido (partido_id, tipo, equipo, detalle, periodo, reloj_segundos_evento) VALUES ($1, $2, $3, $4, $5, $6)',
    [partido.id, 'TIMEOUT', equipo, `Timeout ${equipo}`, partido.periodo, relojActual(partido)]
  );
  return resultado.rows[0];
}

export async function alternarPosesion(partido) {
  const nueva = partido.posesion === 'local' ? 'visita' : 'local';
  const resultado = await pool.query(`UPDATE partidos SET posesion = $1, actualizado_en = now() WHERE id = $2 RETURNING *`, [
    nueva,
    partido.id,
  ]);
  return resultado.rows[0];
}

export async function iniciarReloj(partido) {
  const resultado = await pool.query(
    `UPDATE partidos SET reloj_corriendo = true, reloj_referencia_en = now(), actualizado_en = now() WHERE id = $1 RETURNING *`,
    [partido.id]
  );
  return resultado.rows[0];
}

export async function pausarReloj(partido) {
  const restante = relojActual(partido);
  const resultado = await pool.query(
    `UPDATE partidos SET reloj_corriendo = false, reloj_segundos = $1, reloj_referencia_en = NULL, actualizado_en = now() WHERE id = $2 RETURNING *`,
    [restante, partido.id]
  );
  return resultado.rows[0];
}

export async function ajustarReloj(partido, deltaSegundos) {
  const actual = relojActual(partido);
  const nuevo = Math.max(0, actual + deltaSegundos);
  if (partido.reloj_corriendo) {
    const resultado = await pool.query(
      `UPDATE partidos SET reloj_segundos = $1, reloj_referencia_en = now(), actualizado_en = now() WHERE id = $2 RETURNING *`,
      [nuevo, partido.id]
    );
    return resultado.rows[0];
  }
  const resultado = await pool.query(
    `UPDATE partidos SET reloj_segundos = $1, actualizado_en = now() WHERE id = $2 RETURNING *`,
    [nuevo, partido.id]
  );
  return resultado.rows[0];
}

// Elegir el cuarto/prórroga que se está jugando desde una lista (reemplaza
// los botones de +1/-1 período) — sea cual sea el que elija, arranca "de
// cero" para ESE período: reloj a los minutos completos, timeouts a 3,
// faltas del período en 0. Minutos por período/prórroga son una regla del
// partido, sembrada al crearlo desde el diseño elegido (ver POST /partidos).
export async function fijarPeriodo(partido, periodoElegido) {
  const nuevoPeriodo = Math.max(1, Math.min(20, Number(periodoElegido) || 1));
  const minutosPeriodo = Number(partido.minutos_periodo) || 10;
  const minutosProrroga = Number(partido.minutos_prorroga) || 5;
  const relojInicial = (nuevoPeriodo > 4 ? minutosProrroga : minutosPeriodo) * 60;
  const resultado = await pool.query(
    `UPDATE partidos SET periodo = $1, reloj_segundos = $2, reloj_corriendo = false, reloj_referencia_en = NULL, timeouts_local = 3, timeouts_visita = 3, faltas_periodo_local = 0, faltas_periodo_visita = 0, actualizado_en = now() WHERE id = $3 RETURNING *`,
    [nuevoPeriodo, relojInicial, partido.id]
  );
  await pool.query('INSERT INTO eventos_partido (partido_id, tipo, detalle) VALUES ($1, $2, $3)', [
    partido.id,
    'PERIODO',
    `Pasa al período ${nuevoPeriodo}`,
  ]);
  return resultado.rows[0];
}

// Reinicia el reloj a los minutos completos del período ACTUAL (sin cambiar
// de período) — para corregir un reloj que se desajustó, distinto de
// RELOJ_AJUSTAR (que suma/resta de a un minuto). Queda pausado al reiniciar,
// para que el arranque real lo dispare el botón "Iniciar" a propósito.
export async function reiniciarReloj(partido) {
  const minutosPeriodo = Number(partido.minutos_periodo) || 10;
  const minutosProrroga = Number(partido.minutos_prorroga) || 5;
  const relojInicial = (partido.periodo > 4 ? minutosProrroga : minutosPeriodo) * 60;
  const resultado = await pool.query(
    `UPDATE partidos SET reloj_segundos = $1, reloj_corriendo = false, reloj_referencia_en = NULL, actualizado_en = now() WHERE id = $2 RETURNING *`,
    [relojInicial, partido.id]
  );
  return resultado.rows[0];
}

// A diferencia de SUSTITUCION (un jugador puntual sale, otro entra), esto
// cubre el "✎ Editar quinteto" de la Mesa (elegir/reelegir el cinco titular,
// o cambiar varios de una) — antes NO dejaba ningún rastro en
// eventos_partido, así que ese tiempo en cancha quedaba invisible para
// "minutos jugados". Se compara el quinteto NUEVO contra el que traía
// `partido` (el de antes de este cambio) para saber quién entró/salió, y se
// guarda con el reloj de juego de ese instante.
export async function actualizarQuintetos(partido, { quintetoLocalIds, quintetoVisitaIds }) {
  const resultado = await pool.query(
    `UPDATE partidos SET quinteto_local_ids = $1, quinteto_visita_ids = $2, actualizado_en = now() WHERE id = $3 RETURNING *`,
    [quintetoLocalIds, quintetoVisitaIds, partido.id]
  );

  const reloj = relojActual(partido);
  const registrarDiff = async (equipo, anteriores, nuevos) => {
    const salieron = anteriores.filter((id) => !nuevos.includes(id));
    const entraron = nuevos.filter((id) => !anteriores.includes(id));
    if (salieron.length === 0 && entraron.length === 0) return;
    await pool.query(
      `INSERT INTO eventos_partido (partido_id, tipo, equipo, periodo, reloj_segundos_evento, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [partido.id, 'QUINTETO_ACTUALIZAR', equipo, partido.periodo, reloj, JSON.stringify({ entraron, salieron })]
    );
  };
  await registrarDiff('local', partido.quinteto_local_ids, quintetoLocalIds);
  await registrarDiff('visita', partido.quinteto_visita_ids, quintetoVisitaIds);

  return resultado.rows[0];
}

// Convocados: quiénes del plantel guardado del equipo juegan ESTE partido —
// no toca el plantel (jugadores.equipo_id sigue igual), solo filtra el
// roster que se usa para anotar jugadas/elegir quinteto (ver cargarRoster).
// Array vacío = sin convocatoria armada, juega el plantel completo (el
// comportamiento de siempre) — es la opción "dejar a todos" que pide el
// usuario, no un caso especial aparte.
export async function actualizarConvocados(partido, { equipo, ids }) {
  const columna = equipo === 'local' ? 'convocados_local_ids' : 'convocados_visita_ids';
  const resultado = await pool.query(
    `UPDATE partidos SET ${columna} = $1, actualizado_en = now() WHERE id = $2 RETURNING *`,
    [ids, partido.id]
  );
  return resultado.rows[0];
}

// Minutos jugados EN CANCHA por jugador — se arma leyendo cuándo entró y
// cuándo salió cada uno (SUSTITUCION + QUINTETO_ACTUALIZAR, las dos únicas
// fuentes de "cambios de quinteto") y sumando el tiempo de RELOJ DE JUEGO
// (no tiempo real: si el reloj está pausado, ese rato no suma) entre cada
// entrada y su salida correspondiente. Si un tramo cruza un cambio de
// período, se parte en el resto del período de entrada + los períodos
// completos de por medio + lo ya jugado del período de salida — así un
// jugador que sigue en cancha de un cuarto al otro sin sustituciones no
// pierde ese tiempo. Quien sigue en cancha sin una salida registrada
// todavía (está jugando ahora mismo) cierra su tramo con el reloj actual.
export async function minutosJugados(partido) {
  const resultado = await pool.query(
    `SELECT tipo, periodo, reloj_segundos_evento, metadata, creado_en, id
     FROM eventos_partido
     WHERE partido_id = $1 AND tipo IN ('SUSTITUCION', 'QUINTETO_ACTUALIZAR') AND reloj_segundos_evento IS NOT NULL
     ORDER BY creado_en ASC, id ASC`,
    [partido.id]
  );

  const duracionPeriodo = (periodo) =>
    (periodo > 4 ? Number(partido.minutos_prorroga) || 5 : Number(partido.minutos_periodo) || 10) * 60;

  const totales = new Map();
  const sumar = (jugadorId, desde, hasta) => {
    if (!jugadorId) return;
    let segundos;
    if (desde.periodo === hasta.periodo) {
      segundos = Math.max(0, desde.reloj - hasta.reloj);
    } else {
      segundos = Math.max(0, desde.reloj);
      for (let p = desde.periodo + 1; p < hasta.periodo; p++) segundos += duracionPeriodo(p);
      segundos += Math.max(0, duracionPeriodo(hasta.periodo) - hasta.reloj);
    }
    totales.set(jugadorId, (totales.get(jugadorId) || 0) + segundos);
  };

  const abiertos = new Map();
  const entra = (jugadorId, periodo, reloj) => { if (jugadorId) abiertos.set(jugadorId, { periodo, reloj }); };
  const sale = (jugadorId, periodo, reloj) => {
    if (!jugadorId) return;
    const desde = abiertos.get(jugadorId);
    abiertos.delete(jugadorId);
    if (desde) sumar(jugadorId, desde, { periodo, reloj });
  };

  for (const fila of resultado.rows) {
    const periodo = fila.periodo ?? 1;
    const reloj = fila.reloj_segundos_evento;
    if (fila.tipo === 'SUSTITUCION') {
      const { jugadorSaleId, jugadorEntraId } = fila.metadata || {};
      sale(jugadorSaleId, periodo, reloj);
      entra(jugadorEntraId, periodo, reloj);
    } else {
      const { entraron = [], salieron = [] } = fila.metadata || {};
      for (const id of salieron) sale(id, periodo, reloj);
      for (const id of entraron) entra(id, periodo, reloj);
    }
  }

  const ahora = { periodo: partido.periodo, reloj: relojActual(partido) };
  for (const [jugadorId, desde] of abiertos.entries()) sumar(jugadorId, desde, ahora);

  return totales;
}

// Vuelve el partido a su estado inicial de juego (marcador, faltas, reloj,
// período, quintetos, estadísticas por jugador) SIN tocar su id ni su
// public_token — es el mecanismo para "empezar de nuevo" sobre el mismo
// diseño con el mismo enlace ya cargado en OBS, en vez de crear un partido
// (y por lo tanto un enlace) distinto cada vez que se quiere jugar otro juego.
// Guarda una foto fija del partido (marcador final + estadísticas completas
// de cada jugador, mismo formato que arma construirEstado) antes de que se
// pierda de verdad — hoy el único momento en que eso pasa es reiniciarPartido
// (ver abajo), que borra eventos_partido para dejar el mismo enlace de OBS
// listo para el próximo partido. Sin esto, "Reiniciar Partido" tiraba
// las estadísticas completas del partido anterior sin ninguna forma de
// volver a verlas. Si no hubo ninguna jugada todavía (partido recién creado,
// nunca arrancó), no archiva nada — no tiene sentido guardar un 0-0 vacío.
export async function archivarPartido(partido) {
  const tieneEventos = await pool.query('SELECT 1 FROM eventos_partido WHERE partido_id = $1 LIMIT 1', [partido.id]);
  if (tieneEventos.rows.length === 0) return null;

  const estado = await construirEstado(partido);
  const resumen = { ...estado, puntosPorPeriodo: await puntosPorPeriodo(partido.id) };
  const resultado = await pool.query(
    `INSERT INTO partidos_archivados
       (user_id, partido_id, equipo_local_nombre, equipo_visita_nombre, equipo_local_color, equipo_visita_color, equipo_local_logo_url, equipo_visita_logo_url, pts_local, pts_visita, resumen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb) RETURNING *`,
    [
      partido.user_id, partido.id,
      estado.equipoLocal.nombre, estado.equipoVisita.nombre,
      estado.equipoLocal.color, estado.equipoVisita.color,
      estado.equipoLocal.logo_url, estado.equipoVisita.logo_url,
      estado.ptsLocal, estado.ptsVisita,
      JSON.stringify(resumen),
    ]
  );
  return resultado.rows[0];
}

export async function reiniciarPartido(partido) {
  await archivarPartido(partido);
  const relojInicial = (Number(partido.minutos_periodo) || 10) * 60;
  const resultado = await pool.query(
    `UPDATE partidos SET
       estado = 'en_curso', periodo = 1, reloj_segundos = $1, reloj_corriendo = false, reloj_referencia_en = NULL,
       pts_local = 0, pts_visita = 0, faltas_local = 0, faltas_visita = 0,
       faltas_periodo_local = 0, faltas_periodo_visita = 0,
       timeouts_local = 3, timeouts_visita = 3, posesion = NULL,
       quinteto_local_ids = '{}', quinteto_visita_ids = '{}',
       actualizado_en = now()
     WHERE id = $2 RETURNING *`,
    [relojInicial, partido.id]
  );
  await pool.query('DELETE FROM eventos_partido WHERE partido_id = $1', [partido.id]);
  return resultado.rows[0];
}

export async function cambiarEstadoPartido(partido, estado) {
  const resultado = await pool.query(`UPDATE partidos SET estado = $1, actualizado_en = now() WHERE id = $2 RETURNING *`, [
    estado,
    partido.id,
  ]);
  return resultado.rows[0];
}
