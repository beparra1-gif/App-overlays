import pool from '../db.js';
import { verificarSesion, verificarTokenLector } from '../middleware/auth.js';
import {
  cargarPartidoPorToken,
  cargarPartidoPorId,
  construirEstado,
  registrarPunto,
  corregirPuntos,
  corregirFaltas,
  corregirFaltasEquipo,
  registrarTiroLibre,
  registrarFalta,
  registrarRebote,
  registrarAsistencia,
  registrarRobo,
  registrarPerdida,
  registrarSustitucion,
  usarTimeout,
  deshacerJugada,
  alternarPosesion,
  iniciarReloj,
  pausarReloj,
  ajustarReloj,
  fijarReloj,
  fijarPeriodo,
  reiniciarReloj,
  cambiarEstadoPartido,
  actualizarQuintetos,
  actualizarConvocados,
  relojActual,
  puntosPorPeriodo,
  reiniciarPartido,
  actualizarSincronizacionCamara,
  fijarPosesion,
  detenerPosesionEnCero,
  relojPosesionActual,
  asignarAnotacion,
} from './estadoPartido.js';
import { cargarEscenaConDiseno } from './escenas.js';
import { describirJugada } from './jugadas.js';

const EQUIPOS_VALIDOS = ['local', 'visita'];
const ESTADOS_VALIDOS = ['prepartido', 'en_curso', 'finalizado'];
const TIPOS_FALTA_VALIDOS = ['personal', 'tecnica', 'tecnica_banco', 'antideportiva', 'descalificante'];
const MODOS_NOMINA_VALIDOS = ['local', 'visita', 'ambos', 'presentacion'];
const TIPOS_CON_JUGADA = new Set([
  'PUNTO', 'TIRO_LIBRE', 'FALTA', 'REBOTE', 'ASISTENCIA', 'ROBO', 'PERDIDA', 'SUSTITUCION', 'TIMEOUT',
  'PERIODO_FIJAR', 'RELOJ_REINICIAR', 'PARTIDO_REINICIAR',
]);

// Partidos con el reloj corriendo, para hacerles tick cada segundo. Se
// re-lee cada fila desde Postgres en cada tick (no se cachea el estado en
// memoria) para que el reloj nunca se desincronice de lo que persiste la
// Mesa — a la escala de partidos simultáneos de un solo usuario, el costo
// extra de esa lectura es insignificante frente a la garantía de consistencia.
const partidosConRelojActivo = new Map();

// Estado EN VIVO de la transmisión (no es una regla de juego, no se guarda
// en la base): marcador oculto, cartel de Entretiempo e Intertanto. Antes
// vivía solo en el navegador de la Mesa y en el de OBS — si la fuente de
// OBS se recargaba (o se abría una segunda Mesa), se perdía: el marcador
// volvía a aparecer en pleno corte, o el botón de la Mesa mostraba el
// estado equivocado. Ahora el servidor lo recuerda por partido y se lo
// reenvía a quien se une.
const transmisionPorToken = new Map();
function transmision(publicToken) {
  if (!transmisionPorToken.has(publicToken)) {
    transmisionPorToken.set(publicToken, { marcadorOculto: false, alerta: null, intertanto: null });
  }
  return transmisionPorToken.get(publicToken);
}

// Config del diseño enlazado a la escena de marcador de un partido — solo
// se consulta cuando el reloj llega a 0 (para decidir si el Intertanto se
// muestra solo), no en cada tick.
async function configDisenoDelPartido(partidoId) {
  const resultado = await pool.query(
    `SELECT d.config FROM escenas e JOIN disenos_guardados d ON d.id = e.diseno_id
     WHERE e.partido_id = $1 AND e.tipo = 'marcador'
     ORDER BY e.creado_en ASC LIMIT 1`,
    [partidoId]
  );
  return resultado.rows[0]?.config || {};
}

const roomPartido = (publicToken) => `partido:${publicToken}`;
const roomEscena = (escenaToken) => `escena:${escenaToken}`;
const roomDiseno = (disenoId) => `diseno:${disenoId}`;

// Serializa las acciones de un mismo partido en el orden en que llegan.
// Cada 'accion' es un handler async (construirEstado incluido, que hace
// sus propias consultas) — sin esto, dos acciones seguidas y rápidas para
// el MISMO partido (p. ej. girar la rueda del mouse del reloj varias
// veces seguidas) corren en paralelo, y no hay garantía de que la que
// llegó primero termine y emita 'estado' primero: la más lenta podía
// terminar después y su 'estado' (más viejo) pisaba al de una acción más
// nueva que ya se había emitido. Encadenar cada tarea a la promesa de la
// anterior, para ese mismo publicToken, hace que corran una por una en
// orden de llegada — partidos distintos entre sí siguen sin bloquearse.
const colaPorToken = new Map();
function encolarPorToken(publicToken, tarea) {
  const anterior = colaPorToken.get(publicToken) || Promise.resolve();
  const siguiente = anterior.then(tarea, tarea);
  const cola = siguiente.catch(() => {});
  colaPorToken.set(publicToken, cola);
  // Sin tareas pendientes, se saca del Map (si no, crecía con cada partido jugado).
  cola.then(() => { if (colaPorToken.get(publicToken) === cola) colaPorToken.delete(publicToken); });
  return siguiente;
}
function serializarPorToken(manejador) {
  return (datos = {}) => encolarPorToken(datos.publicToken, () => manejador(datos));
}

// Acciones que puede mandar el lector de marcador por cámara (token de
// alcance limitado, ver firmarTokenLector) — y qué interruptor de
// "Marcador por cámara" (Mesa) tiene que estar prendido para cada una.
const ACCIONES_LECTOR = {
  RELOJ_FIJAR: 'reloj',
  RELOJ_INICIAR: 'reloj',
  RELOJ_PAUSAR: 'reloj',
  POSESION_FIJAR: 'reloj',
  PUNTOS_CORREGIR: 'puntos',
  PERIODO_FIJAR: 'periodo',
  FALTAS_EQUIPO_CORREGIR: 'faltas',
};

// 'dueno' (sesión normal del dueño del partido), 'lector' (enlace del
// lector, solo para ESTE partido) o null. Antes cualquier JWT válido del
// dueño pasaba, sin mirar su alcance.
async function autorizacion(token, partido) {
  if (!token) return null;
  // Misma verificación que la API: firma, vencimiento y versión de sesión.
  const payload = await verificarSesion(token);
  if (!payload || payload.userId !== partido.user_id) return null;
  if (payload.scope === 'lector') return payload.partidoId === partido.id ? 'lector' : null;
  if (payload.scope === 'operador') return 'dueno'; // maneja el partido igual que el dueño
  if (payload.scope) return null;
  return 'dueno';
}

// Último latido de cada lector conectado (por publicToken del partido) —
// mientras haya un lector vivo y el partido tenga "Marcador por cámara"
// activo, los puntos/faltas que carga la Mesa NO suman al total (lo manda
// el marcador físico); si el celular se desconecta, la Mesa vuelve sola a
// sumar como siempre, sin quedarse congelada.
const LECTOR_VIVO_MS = 12000;
const lectoresPorToken = new Map();
const lectorVivo = (publicToken) => {
  const l = lectoresPorToken.get(publicToken);
  return Boolean(l && Date.now() - l.ultimoLatido < LECTOR_VIVO_MS);
};
const resumenLector = (publicToken) => {
  const l = lectoresPorToken.get(publicToken);
  return { conectado: lectorVivo(publicToken), ultimoLatido: l?.ultimoLatido || null, lecturas: l?.lecturas || null, modo: l?.modo || null };
};

function buscarJugador(estado, jugadorId) {
  if (!jugadorId) return null;
  return (
    estado.equipoLocal.roster.find((j) => j.id === jugadorId) ||
    estado.equipoVisita.roster.find((j) => j.id === jugadorId) ||
    null
  );
}

export function registrarSocketPartidos(io) {
  // Cuántos sockets hay ahora mismo en la room de una escena puntual — así
  // la Mesa puede saber si el enlace que pegó en OBS realmente tiene a
  // alguien mirándolo del otro lado, en vez de asumirlo a ciegas.
  const cantidadViewers = (escenaToken) => io.sockets.adapter.rooms.get(roomEscena(escenaToken))?.size || 0;
  const avisarViewers = (publicTokenPartido, escenaToken) => {
    io.to(roomPartido(publicTokenPartido)).emit('escena_viewers', { escenaToken, cantidad: cantidadViewers(escenaToken) });
  };

  // Reenvía a UN socket recién unido el estado en vivo de la transmisión
  // (ver transmisionPorToken) — solo lo que está prendido, para no mandar
  // eventos de más.
  const enviarTransmision = (socket, publicToken) => {
    const t = transmisionPorToken.get(publicToken);
    if (!t) return;
    if (t.marcadorOculto) socket.emit('marcador_visibilidad', { oculto: true });
    if (t.alerta) socket.emit('marcador_alerta', t.alerta);
    if (t.intertanto) socket.emit('intertanto', t.intertanto);
  };

  const avisarLector = (publicToken) => io.to(roomPartido(publicToken)).emit('lector_estado', resumenLector(publicToken));

  const emitirIntertanto = (publicToken, datos) => {
    const t = transmision(publicToken);
    t.intertanto = datos?.activo ? datos : null;
    io.to(roomPartido(publicToken)).emit('intertanto', datos?.activo ? datos : { activo: false });
  };

  // Si el servidor se reinicia con un reloj corriendo, el Map de relojes
  // activos arrancaba vacío y ese partido dejaba de recibir ticks (y nunca
  // se frenaba solo en 0). Se reconstruye desde la base al arrancar, y
  // además cada vez que alguien se une a un partido con el reloj en marcha.
  const vigilarRelojSiCorre = (partido) => {
    if (partido?.reloj_corriendo) partidosConRelojActivo.set(partido.id, partido.public_token);
  };
  pool.query('SELECT id, public_token, reloj_corriendo FROM partidos WHERE reloj_corriendo = true')
    .then((r) => r.rows.forEach(vigilarRelojSiCorre))
    .catch((error) => console.error('[relojes activos al arrancar]', error.message));

  io.on('connection', (socket) => {
    // Se recuerda qué escena/partido se unió ESTE socket puntual, para poder
    // recalcular y avisar el conteo de viewers cuando se desconecte (ver
    // 'disconnect' más abajo) — Socket.IO ya sacó el socket de sus rooms
    // para ese momento, así que alcanza con volver a contar.
    let escenaUnida = null;
    let partidoTokenUnido = null;

    // Escenas públicas (marcador/nómina/estadísticas/anuncios): se unen por
    // su propio token, pero comparten la room del partido para el estado de
    // juego en vivo, más su propia room para enterarse si Mesa cambia esa
    // escena puntual (diseño, activo, config) sin que el resto se entere.
    socket.on('unirse', async ({ escenaToken } = {}) => {
      if (!escenaToken) return;
      try {
      const resultado = await cargarEscenaConDiseno(escenaToken);
      if (!resultado) return socket.emit('error_marcador', { error: 'Escena no encontrada' });
      const partido = await cargarPartidoPorId(resultado.escena.partido_id);
      if (!partido) return socket.emit('error_marcador', { error: 'Partido no encontrado' });

      socket.join(roomPartido(partido.public_token));
      socket.join(roomEscena(escenaToken));
      // Si esta escena usa un diseño, se suma a su room también — así, si el
      // usuario sigue personalizando (colores, logo, animaciones) mientras
      // esta escena ya está abierta en OBS, el cambio le llega solo, sin
      // tener que recargar la fuente del navegador.
      if (resultado.escena.diseno_id) socket.join(roomDiseno(resultado.escena.diseno_id));
      escenaUnida = escenaToken;
      partidoTokenUnido = partido.public_token;
      socket.emit('escena_config', resultado);
      socket.emit('estado', await construirEstado(partido));
      enviarTransmision(socket, partido.public_token);
      vigilarRelojSiCorre(partido);
      avisarViewers(partido.public_token, escenaToken);
      } catch (error) {
        // Un error de base acá (async, sin catch) era un unhandled
        // rejection: en Node moderno eso tumba el proceso entero.
        console.error('[unirse]', error);
        socket.emit('error_marcador', { error: 'No se pudo cargar la escena' });
      }
    });

    // La Mesa de control no representa ninguna escena en particular — se une
    // directo a la room del partido con el token interno que ya trae del
    // REST (`GET /partidos/:id`), sin pasar por una escena.
    socket.on('unirse_mesa', async ({ publicToken } = {}) => {
      if (!publicToken) return;
      try {
        const partido = await cargarPartidoPorToken(publicToken);
        if (!partido) return socket.emit('error_marcador', { error: 'Partido no encontrado' });
        socket.join(roomPartido(publicToken));
        partidoTokenUnido = publicToken;
        socket.emit('estado', await construirEstado(partido));
        enviarTransmision(socket, publicToken);
        socket.emit('lector_estado', resumenLector(publicToken));
        vigilarRelojSiCorre(partido);
      } catch (error) {
        console.error('[unirse_mesa]', error);
        socket.emit('error_marcador', { error: 'No se pudo cargar el partido' });
      }
    });

    // Lector de marcador por cámara (celular en la tribuna, sin login): se
    // une con su token de alcance limitado y avisa que está vivo con un
    // latido periódico que trae sus últimas lecturas (para que la Mesa las vea).
    let lectorDe = null;
    socket.on('unirse_lector', async ({ lectorToken } = {}) => {
      try {
        const datos = await verificarTokenLector(lectorToken);
        if (!datos) return socket.emit('error_marcador', { error: 'El enlace del lector venció o no es válido' });
        const partido = await cargarPartidoPorId(datos.partidoId);
        if (!partido || partido.user_id !== datos.userId) return socket.emit('error_marcador', { error: 'Partido no encontrado' });
        socket.join(roomPartido(partido.public_token));
        lectorDe = partido.public_token;
        socket.emit('estado', await construirEstado(partido));
        vigilarRelojSiCorre(partido);
      } catch (error) {
        console.error('[unirse_lector]', error);
        socket.emit('error_marcador', { error: 'No se pudo conectar el lector' });
      }
    });
    socket.on('lector_latido', ({ lecturas, modo } = {}) => {
      if (!lectorDe) return;
      lectoresPorToken.set(lectorDe, {
        ultimoLatido: Date.now(),
        lecturas: lecturas && typeof lecturas === 'object' ? lecturas : null,
        modo: modo === 'auto' ? 'auto' : 'manual',
      });
      avisarLector(lectorDe);
    });

    // La Mesa pide esto apenas sabe cuál es el token de la escena de
    // marcador, para mostrar de una el conteo actual (no solo enterarse de
    // cambios futuros por 'escena_viewers').
    socket.on('consultar_viewers', ({ escenaToken } = {}) => {
      if (!escenaToken) return;
      socket.emit('escena_viewers', { escenaToken, cantidad: cantidadViewers(escenaToken) });
    });

    socket.on('accion', serializarPorToken(async ({ publicToken, tipo, token, payload = {} } = {}) => {
      try {
        if (!publicToken || !tipo) throw new Error('Solicitud incompleta');
        const partido = await cargarPartidoPorToken(publicToken);
        if (!partido) throw new Error('Partido no encontrado');
        const rol = await autorizacion(token, partido);
        if (!rol) throw new Error('No autorizado para controlar este partido');
        const sincronizacion = partido.sincronizacion_camara || {};
        if (rol === 'lector') {
          const interruptor = ACCIONES_LECTOR[tipo];
          if (!interruptor) throw new Error('Acción no permitida para el lector');
          if (!sincronizacion.activo || !sincronizacion[interruptor]) {
            throw new Error('La Mesa tiene ese dato en modo manual — activalo en "Marcador por cámara"');
          }
        }
        // Mientras la cámara maneja el marcador (y está viva), las jugadas
        // de la Mesa registran estadísticas pero no suman al total.
        const camaraManda = sincronizacion.activo && lectorVivo(publicToken);
        const sumarMarcador = !(camaraManda && sincronizacion.puntos);
        const sumarFaltasPeriodo = !(camaraManda && sincronizacion.faltas);

        if (tipo === 'NOMINA_REPRODUCIR') {
          if (!MODOS_NOMINA_VALIDOS.includes(payload.modo)) throw new Error('Modo de nómina inválido');
          // 'presentacion': introducción del plantel titular uno por uno —
          // a diferencia de 'local'/'visita'/'ambos' (una foto fija del
          // plantel completo), acá Mesa manda la lista COMPLETA de
          // presentados hasta ahora en cada disparo (el último id es el
          // que se está presentando en este instante, el resto ya pasó por
          // su momento y queda en la lista acumulada) — no hace falta
          // ningún estado nuevo en el backend, se relee tal cual llega.
          const jugadorIds = tipo === 'NOMINA_REPRODUCIR' && payload.modo === 'presentacion' && Array.isArray(payload.jugadorIds)
            ? payload.jugadorIds.map(Number).filter(Number.isFinite)
            : undefined;
          const equipoPresentacion = EQUIPOS_VALIDOS.includes(payload.equipo) ? payload.equipo : undefined;
          io.to(roomPartido(publicToken)).emit('nomina_pulso', {
            modo: payload.modo,
            ocultarMarcador: !!payload.ocultarMarcador,
            ...(jugadorIds ? { jugadorIds, equipo: equipoPresentacion } : {}),
          });
          return;
        }

        // Interruptor manual de "mostrar/ocultar marcador" — a diferencia de
        // NOMINA_REPRODUCIR/ESTADISTICAS_MOSTRAR (que ocultan el marcador
        // solo MIENTRAS esa capa está en pantalla, y por un rato limitado),
        // esto lo prende o apaga a criterio de quien maneja la Mesa, sin
        // límite de tiempo — no toca el estado del partido en la base,
        // mismo criterio que los pulsos de arriba (es un control en vivo de
        // la transmisión, no una regla de juego).
        if (tipo === 'MARCADOR_VISIBILIDAD') {
          transmision(publicToken).marcadorOculto = !!payload.oculto;
          io.to(roomPartido(publicToken)).emit('marcador_visibilidad', { oculto: !!payload.oculto });
          return;
        }

        // Intertanto: panel grande de resumen entre cuartos (marcador,
        // puntos por cuarto, comparativa y líderes) — mismo criterio que
        // MARCADOR_ALERTA: control en vivo, no se guarda en la base. Se
        // apaga solo al volver a arrancar el reloj (ver RELOJ_INICIAR).
        if (tipo === 'INTERTANTO') {
          // modo: 'intertanto' | 'previa' | 'final' | 'mvp' (mismo panel, otro contenido).
          const modo = ['previa', 'final', 'mvp', 'tabla'].includes(payload.modo) ? payload.modo : 'intertanto';
          emitirIntertanto(publicToken, payload.activo
            ? { activo: true, modo, ocultarMarcador: payload.ocultarMarcador !== false, ts: Date.now() }
            : { activo: false });
          return;
        }

        // "Entretiempo" / "Minuto solicitado": mismo criterio que
        // MARCADOR_VISIBILIDAD (control en vivo de la transmisión, no una
        // regla de juego, no se guarda en la base) pero en vez de solo
        // ocultar el marcador, reemplaza lo que se ve por un cartel del
        // mismo tamaño de la caja del marcador. `texto` vacío/null apaga la
        // alerta y deja ver el marcador de nuevo.
        if (tipo === 'MARCADOR_ALERTA') {
          const alerta = {
            texto: payload.texto ? String(payload.texto).slice(0, 40) : null,
            equipo: EQUIPOS_VALIDOS.includes(payload.equipo) ? payload.equipo : null,
            // "Minuto solicitado" se apaga solo (mismo criterio que un
            // aviso de Anuncios); "Entretiempo" queda hasta que la Mesa lo
            // apague a mano — la diferencia la decide quien dispara la
            // acción (ver dispararAlertaMarcador/solicitarTimeout en
            // Mesa.jsx), acá solo se reenvía el pedido tal cual.
            autoOcultar: !!payload.autoOcultar,
          };
          // Solo se recuerda el cartel "fijo" (Entretiempo); el que se
          // apaga solo (Minuto solicitado) no tiene sentido reenviarlo.
          if (!alerta.autoOcultar) transmision(publicToken).alerta = alerta.texto ? alerta : null;
          io.to(roomPartido(publicToken)).emit('marcador_alerta', alerta);
          return;
        }

        // Igual que NOMINA_REPRODUCIR: no toca el estado del partido, solo le
        // avisa a quien esté mirando la escena que muestre estadísticas un
        // rato — así queda "a demanda" (se dispara cuando hace falta) en vez
        // de quedar pegado en pantalla todo el partido. `ocultarMarcador`
        // deja elegir, cada vez que se dispara, si el marcador base se tapa
        // mientras tanto o se queda visible debajo — antes siempre quedaba
        // visible, sin poder elegir.
        if (tipo === 'ESTADISTICAS_MOSTRAR') {
          const ocultarMarcador = !!payload.ocultarMarcador;
          if (payload.modo === 'jugador') {
            const jugadorId = Number(payload.jugadorId);
            if (!jugadorId) throw new Error('Jugador inválido');
            io.to(roomPartido(publicToken)).emit('stats_pulso', { modo: 'jugador', jugadorId, ocultarMarcador });
          } else if (payload.modo === 'ambos') {
            const porPeriodo = await puntosPorPeriodo(partido.id);
            io.to(roomPartido(publicToken)).emit('stats_pulso', { modo: 'ambos', detalle: !!payload.detalle, puntosPorPeriodo: porPeriodo, ocultarMarcador });
          } else {
            const equipo = EQUIPOS_VALIDOS.includes(payload.equipo) ? payload.equipo : 'local';
            const porPeriodo = await puntosPorPeriodo(partido.id);
            io.to(roomPartido(publicToken)).emit('stats_pulso', { modo: 'equipo', equipo, detalle: !!payload.detalle, puntosPorPeriodo: porPeriodo, ocultarMarcador });
          }
          return;
        }

        let actualizado;
        let jugadorEntraId = null;
        switch (tipo) {
          case 'PUNTO': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const puntos = Number(payload.puntos);
            if (![1, 2, 3].includes(puntos)) throw new Error('Puntos inválidos');
            actualizado = await registrarPunto(partido, { equipo: payload.equipo, jugadorId: payload.jugadorId || null, puntos }, { sumarMarcador });
            break;
          }
          case 'PUNTOS_CORREGIR': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const puntos = Number(payload.puntos);
            if (!Number.isInteger(puntos) || puntos < 0 || puntos > 999) throw new Error('Puntaje inválido');
            actualizado = await corregirPuntos(partido, { equipo: payload.equipo, puntos });
            // Marcador por cámara con "preguntar quién anotó": la Mesa
            // ofrece las jugadoras en cancha de ese equipo.
            if (rol === 'lector' && sincronizacion.preguntar && actualizado.__correccion?.delta >= 1 && actualizado.__correccion.delta <= 3) {
              io.to(roomPartido(publicToken)).emit('anotacion_pendiente', { ...actualizado.__correccion, puntos: actualizado.__correccion.delta, ts: Date.now() });
            }
            break;
          }
          case 'FALTAS_CORREGIR': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const jugadorId = Number(payload.jugadorId);
            const faltas = Number(payload.faltas);
            if (!jugadorId) throw new Error('Elegí un jugador');
            if (!Number.isInteger(faltas) || faltas < 0 || faltas > 20) throw new Error('Cantidad de faltas inválida');
            actualizado = await corregirFaltas(partido, { equipo: payload.equipo, jugadorId, faltas });
            break;
          }
          case 'FALTAS_EQUIPO_CORREGIR': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const faltasEquipo = Number(payload.faltas);
            if (!Number.isInteger(faltasEquipo) || faltasEquipo < 0 || faltasEquipo > 20) throw new Error('Cantidad de faltas de equipo inválida');
            actualizado = await corregirFaltasEquipo(partido, { equipo: payload.equipo, faltas: faltasEquipo });
            break;
          }
          case 'TIRO_LIBRE': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const convertidos = Number(payload.convertidos);
            const intentos = Number(payload.intentos);
            if (!Number.isInteger(convertidos) || !Number.isInteger(intentos) || convertidos < 0 || convertidos > intentos || intentos < 1 || intentos > 3) {
              throw new Error('Combo de tiros libres inválido');
            }
            actualizado = await registrarTiroLibre(partido, { equipo: payload.equipo, jugadorId: payload.jugadorId || null, convertidos, intentos }, { sumarMarcador });
            break;
          }
          case 'FALTA': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const tipoFalta = TIPOS_FALTA_VALIDOS.includes(payload.tipoFalta) ? payload.tipoFalta : 'personal';
            actualizado = await registrarFalta(partido, { equipo: payload.equipo, jugadorId: payload.jugadorId || null, tipoFalta }, { sumarFaltasPeriodo });
            payload.tipoFalta = tipoFalta;
            break;
          }
          case 'REBOTE':
          case 'ASISTENCIA':
          case 'ROBO':
          case 'PERDIDA': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const registrar = { REBOTE: registrarRebote, ASISTENCIA: registrarAsistencia, ROBO: registrarRobo, PERDIDA: registrarPerdida }[tipo];
            actualizado = await registrar(partido, { equipo: payload.equipo, jugadorId: payload.jugadorId || null });
            break;
          }
          case 'SUSTITUCION': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const jugadorSaleId = Number(payload.jugadorSaleId);
            jugadorEntraId = Number(payload.jugadorEntraId);
            if (!jugadorSaleId || !jugadorEntraId) throw new Error('Sustitución inválida');
            actualizado = await registrarSustitucion(partido, { equipo: payload.equipo, jugadorSaleId, jugadorEntraId });
            break;
          }
          case 'DESHACER': {
            actualizado = await deshacerJugada(partido, payload.eventoId);
            break;
          }
          case 'TIMEOUT': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            actualizado = await usarTimeout(partido, payload.equipo);
            break;
          }
          case 'POSESION_TOGGLE':
            actualizado = await alternarPosesion(partido);
            break;
          case 'RELOJ_INICIAR':
            actualizado = await iniciarReloj(partido, Number.isFinite(Number(payload.segundos)) && payload.segundos !== null && payload.segundos !== undefined ? Number(payload.segundos) : null);
            partidosConRelojActivo.set(actualizado.id, publicToken);
            // Arranca el juego: el Intertanto (si estaba en pantalla) se va solo.
            if (transmisionPorToken.get(publicToken)?.intertanto) emitirIntertanto(publicToken, { activo: false });
            break;
          case 'RELOJ_PAUSAR':
            actualizado = await pausarReloj(partido, Number.isFinite(Number(payload.segundos)) && payload.segundos !== null && payload.segundos !== undefined ? Number(payload.segundos) : null);
            partidosConRelojActivo.delete(actualizado.id);
            break;
          case 'RELOJ_AJUSTAR': {
            const delta = Number(payload.segundos);
            if (!Number.isFinite(delta)) throw new Error('Ajuste de reloj inválido');
            actualizado = await ajustarReloj(partido, delta);
            break;
          }
          case 'RELOJ_FIJAR': {
            const totalSegundos = Number(payload.segundos);
            if (!Number.isFinite(totalSegundos) || totalSegundos < 0) throw new Error('Tiempo de reloj inválido');
            actualizado = await fijarReloj(partido, totalSegundos);
            break;
          }
          case 'PERIODO_FIJAR': {
            const periodoElegido = Number(payload.periodo);
            if (!Number.isInteger(periodoElegido) || periodoElegido < 1) throw new Error('Período inválido');
            actualizado = await fijarPeriodo(partido, periodoElegido);
            partidosConRelojActivo.delete(actualizado.id);
            break;
          }
          case 'POSESION_FIJAR': {
            const seg = Number(payload.segundos);
            if (!Number.isFinite(seg) || seg < 0 || seg > 24) throw new Error('Reloj de posesión inválido');
            actualizado = await fijarPosesion(partido, seg);
            break;
          }
          case 'RELOJ_REINICIAR':
            actualizado = await reiniciarReloj(partido);
            partidosConRelojActivo.delete(actualizado.id);
            break;
          case 'ESTADO_PARTIDO':
            if (!ESTADOS_VALIDOS.includes(payload.estado)) throw new Error('Estado inválido');
            actualizado = await cambiarEstadoPartido(partido, payload.estado);
            break;
          case 'PARTIDO_REINICIAR':
            actualizado = await reiniciarPartido(partido, payload, io);
            partidosConRelojActivo.delete(actualizado.id);
            if (transmisionPorToken.get(publicToken)?.intertanto) emitirIntertanto(publicToken, { activo: false });
            break;
          case 'QUINTETO_ACTUALIZAR': {
            const quintetoLocalIds = Array.isArray(payload.quintetoLocalIds)
              ? payload.quintetoLocalIds.map(Number)
              : partido.quinteto_local_ids;
            const quintetoVisitaIds = Array.isArray(payload.quintetoVisitaIds)
              ? payload.quintetoVisitaIds.map(Number)
              : partido.quinteto_visita_ids;
            actualizado = await actualizarQuintetos(partido, { quintetoLocalIds, quintetoVisitaIds });
            break;
          }
          case 'ASIGNAR_ANOTACION': {
            const eventoId = Number(payload.eventoId);
            const jugadorId = Number(payload.jugadorId);
            if (!eventoId || !jugadorId) throw new Error('Anotación inválida');
            const asignada = await asignarAnotacion(partido, { eventoId, jugadorId });
            actualizado = partido;
            payload.equipo = asignada.equipo;
            payload.jugadorId = jugadorId;
            payload.puntos = asignada.puntos;
            payload.convertidos = 1;
            payload.intentos = 1;
            payload.tipoJugada = asignada.esLibre ? 'TIRO_LIBRE' : 'PUNTO';
            break;
          }
          case 'SINCRONIZACION_CAMARA':
            actualizado = await actualizarSincronizacionCamara(partido, payload);
            break;
          case 'CONVOCADOS_ACTUALIZAR': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const ids = Array.isArray(payload.ids) ? payload.ids.map(Number).filter(Number.isFinite) : [];
            actualizado = await actualizarConvocados(partido, { equipo: payload.equipo, ids });
            break;
          }
          default:
            throw new Error(`Acción desconocida: ${tipo}`);
        }

        const estado = await construirEstado(actualizado);
        io.to(roomPartido(publicToken)).emit('estado', estado);

        const tipoAnuncio = tipo === 'ASIGNAR_ANOTACION' ? payload.tipoJugada : tipo;
        if (TIPOS_CON_JUGADA.has(tipoAnuncio)) {
          const equipoNombre = payload.equipo === 'visita' ? estado.equipoVisita.nombre : estado.equipoLocal.nombre;
          const texto = describirJugada(tipoAnuncio, payload, {
            jugador: buscarJugador(estado, payload.jugadorId),
            jugadorEntra: buscarJugador(estado, jugadorEntraId),
            equipoNombre,
          });
          if (texto) io.to(roomPartido(publicToken)).emit('jugada', { texto, tipo: tipoAnuncio, equipo: payload.equipo || null, ts: Date.now() });
        }
      } catch (error) {
        socket.emit('error_marcador', { error: error.message || 'No se pudo aplicar la acción' });
      }
    }));

    socket.on('disconnect', () => {
      if (escenaUnida && partidoTokenUnido) avisarViewers(partidoTokenUnido, escenaUnida);
      if (lectorDe) {
        lectoresPorToken.delete(lectorDe);
        avisarLector(lectorDe);
      }
      // Nadie más mirando ese partido: se olvida su estado de transmisión en vivo.
      const token = partidoTokenUnido || lectorDe;
      if (token && !io.sockets.adapter.rooms.get(roomPartido(token))?.size) transmisionPorToken.delete(token);
    });
  });

  // Las pantallas calculan el reloj solas (useRelojVivo, desde la hora de
  // referencia): el estado completo se reenvía cada 5 s solo para
  // resincronizar, no cada segundo (eran ~11 consultas por partido por segundo).
  let vuelta = 0;
  setInterval(async () => {
    vuelta += 1;
    for (const [partidoId, publicToken] of partidosConRelojActivo.entries()) {
      // Por la misma cola que las acciones: si no, un tick que leyó el partido
      // ANTES de una anotación emitía después ese estado viejo (58→60→58→60,
      // y la animación "+2" salía dos veces).
      await encolarPorToken(publicToken, async () => {
      try {
        const partido = await cargarPartidoPorId(partidoId);
        if (!partido || !partido.reloj_corriendo) {
          partidosConRelojActivo.delete(partidoId);
          return;
        }
        // Reloj de posesión en 0: se detiene y avisa (la bocina la decide
        // el árbitro; el reloj de juego sigue hasta que lo paren).
        if (partido.posesion_corriendo && relojPosesionActual(partido) <= 0) {
          const sinPosesion = await detenerPosesionEnCero(partido);
          io.to(roomPartido(publicToken)).emit('posesion_cero', { ts: Date.now() });
          Object.assign(partido, sinPosesion);
        }
        if (relojActual(partido) <= 0) {
          const detenido = await pausarReloj(partido);
          partidosConRelojActivo.delete(partidoId);
          io.to(roomPartido(publicToken)).emit('estado', await construirEstado(detenido));
          // Fin del cuarto: si el diseño lo pide (Personalizar → Intertanto
          // → "Mostrar solo al terminar cada cuarto"), aparece el resumen.
          const cfg = await configDisenoDelPartido(partidoId);
          if (cfg.mostrarIntertanto !== false && cfg.intertantoAuto !== false) {
            emitirIntertanto(publicToken, { activo: true, ocultarMarcador: cfg.intertantoOcultarMarcador !== false, auto: true, ts: Date.now() });
          }
          return;
        }
        if (vuelta % 5 === 0) io.to(roomPartido(publicToken)).emit('estado', await construirEstado(partido));
      } catch (error) {
        console.error('[tick reloj]', error);
      }
      });
    }
  }, 1000);
}
