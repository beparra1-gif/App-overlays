import jwt from 'jsonwebtoken';
import {
  cargarPartidoPorToken,
  cargarPartidoPorId,
  construirEstado,
  registrarPunto,
  corregirPuntos,
  registrarTiroLibre,
  registrarFalta,
  registrarRebote,
  registrarAsistencia,
  registrarRobo,
  registrarPerdida,
  registrarSustitucion,
  usarTimeout,
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
} from './estadoPartido.js';
import { cargarEscenaConDiseno } from './escenas.js';
import { describirJugada } from './jugadas.js';

const EQUIPOS_VALIDOS = ['local', 'visita'];
const ESTADOS_VALIDOS = ['prepartido', 'en_curso', 'finalizado'];
const TIPOS_FALTA_VALIDOS = ['personal', 'tecnica', 'antideportiva', 'descalificante'];
const MODOS_NOMINA_VALIDOS = ['local', 'visita', 'ambos'];
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

const roomPartido = (publicToken) => `partido:${publicToken}`;
const roomEscena = (escenaToken) => `escena:${escenaToken}`;
const roomDiseno = (disenoId) => `diseno:${disenoId}`;

function usuarioAutorizado(token, partido) {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.userId === partido.user_id;
  } catch {
    return false;
  }
}

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
      avisarViewers(partido.public_token, escenaToken);
    });

    // La Mesa de control no representa ninguna escena en particular — se une
    // directo a la room del partido con el token interno que ya trae del
    // REST (`GET /partidos/:id`), sin pasar por una escena.
    socket.on('unirse_mesa', async ({ publicToken } = {}) => {
      if (!publicToken) return;
      const partido = await cargarPartidoPorToken(publicToken);
      if (!partido) return socket.emit('error_marcador', { error: 'Partido no encontrado' });
      socket.join(roomPartido(publicToken));
      socket.emit('estado', await construirEstado(partido));
    });

    // La Mesa pide esto apenas sabe cuál es el token de la escena de
    // marcador, para mostrar de una el conteo actual (no solo enterarse de
    // cambios futuros por 'escena_viewers').
    socket.on('consultar_viewers', ({ escenaToken } = {}) => {
      if (!escenaToken) return;
      socket.emit('escena_viewers', { escenaToken, cantidad: cantidadViewers(escenaToken) });
    });

    socket.on('accion', async ({ publicToken, tipo, token, payload = {} } = {}) => {
      try {
        if (!publicToken || !tipo) throw new Error('Solicitud incompleta');
        const partido = await cargarPartidoPorToken(publicToken);
        if (!partido) throw new Error('Partido no encontrado');
        if (!usuarioAutorizado(token, partido)) throw new Error('No autorizado para controlar este partido');

        if (tipo === 'NOMINA_REPRODUCIR') {
          if (!MODOS_NOMINA_VALIDOS.includes(payload.modo)) throw new Error('Modo de nómina inválido');
          io.to(roomPartido(publicToken)).emit('nomina_pulso', { modo: payload.modo, ocultarMarcador: !!payload.ocultarMarcador });
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
          io.to(roomPartido(publicToken)).emit('marcador_visibilidad', { oculto: !!payload.oculto });
          return;
        }

        // "Entretiempo" / "Minuto solicitado": mismo criterio que
        // MARCADOR_VISIBILIDAD (control en vivo de la transmisión, no una
        // regla de juego, no se guarda en la base) pero en vez de solo
        // ocultar el marcador, reemplaza lo que se ve por un cartel del
        // mismo tamaño de la caja del marcador. `texto` vacío/null apaga la
        // alerta y deja ver el marcador de nuevo.
        if (tipo === 'MARCADOR_ALERTA') {
          io.to(roomPartido(publicToken)).emit('marcador_alerta', {
            texto: payload.texto ? String(payload.texto).slice(0, 40) : null,
            equipo: EQUIPOS_VALIDOS.includes(payload.equipo) ? payload.equipo : null,
            // "Minuto solicitado" se apaga solo (mismo criterio que un
            // aviso de Anuncios); "Entretiempo" queda hasta que la Mesa lo
            // apague a mano — la diferencia la decide quien dispara la
            // acción (ver dispararAlertaMarcador/solicitarTimeout en
            // Mesa.jsx), acá solo se reenvía el pedido tal cual.
            autoOcultar: !!payload.autoOcultar,
          });
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
            actualizado = await registrarPunto(partido, { equipo: payload.equipo, jugadorId: payload.jugadorId || null, puntos });
            break;
          }
          case 'PUNTOS_CORREGIR': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const puntos = Number(payload.puntos);
            if (!Number.isInteger(puntos) || puntos < 0 || puntos > 999) throw new Error('Puntaje inválido');
            actualizado = await corregirPuntos(partido, { equipo: payload.equipo, puntos });
            break;
          }
          case 'TIRO_LIBRE': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const convertidos = Number(payload.convertidos);
            const intentos = Number(payload.intentos);
            if (!Number.isInteger(convertidos) || !Number.isInteger(intentos) || convertidos < 0 || convertidos > intentos || intentos < 1 || intentos > 3) {
              throw new Error('Combo de tiros libres inválido');
            }
            actualizado = await registrarTiroLibre(partido, { equipo: payload.equipo, jugadorId: payload.jugadorId || null, convertidos, intentos });
            break;
          }
          case 'FALTA': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            const tipoFalta = TIPOS_FALTA_VALIDOS.includes(payload.tipoFalta) ? payload.tipoFalta : 'personal';
            actualizado = await registrarFalta(partido, { equipo: payload.equipo, jugadorId: payload.jugadorId || null, tipoFalta });
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
          case 'TIMEOUT': {
            if (!EQUIPOS_VALIDOS.includes(payload.equipo)) throw new Error('Equipo inválido');
            actualizado = await usarTimeout(partido, payload.equipo);
            break;
          }
          case 'POSESION_TOGGLE':
            actualizado = await alternarPosesion(partido);
            break;
          case 'RELOJ_INICIAR':
            actualizado = await iniciarReloj(partido);
            partidosConRelojActivo.set(actualizado.id, publicToken);
            break;
          case 'RELOJ_PAUSAR':
            actualizado = await pausarReloj(partido);
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
          case 'RELOJ_REINICIAR':
            actualizado = await reiniciarReloj(partido);
            partidosConRelojActivo.delete(actualizado.id);
            break;
          case 'ESTADO_PARTIDO':
            if (!ESTADOS_VALIDOS.includes(payload.estado)) throw new Error('Estado inválido');
            actualizado = await cambiarEstadoPartido(partido, payload.estado);
            break;
          case 'PARTIDO_REINICIAR':
            actualizado = await reiniciarPartido(partido, payload);
            partidosConRelojActivo.delete(actualizado.id);
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

        if (TIPOS_CON_JUGADA.has(tipo)) {
          const equipoNombre = payload.equipo === 'visita' ? estado.equipoVisita.nombre : estado.equipoLocal.nombre;
          const texto = describirJugada(tipo, payload, {
            jugador: buscarJugador(estado, payload.jugadorId),
            jugadorEntra: buscarJugador(estado, jugadorEntraId),
            equipoNombre,
          });
          if (texto) io.to(roomPartido(publicToken)).emit('jugada', { texto, tipo, equipo: payload.equipo || null, ts: Date.now() });
        }
      } catch (error) {
        socket.emit('error_marcador', { error: error.message || 'No se pudo aplicar la acción' });
      }
    });

    socket.on('disconnect', () => {
      if (escenaUnida && partidoTokenUnido) avisarViewers(partidoTokenUnido, escenaUnida);
    });
  });

  setInterval(async () => {
    for (const [partidoId, publicToken] of partidosConRelojActivo.entries()) {
      try {
        const partido = await cargarPartidoPorId(partidoId);
        if (!partido || !partido.reloj_corriendo) {
          partidosConRelojActivo.delete(partidoId);
          continue;
        }
        if (relojActual(partido) <= 0) {
          const detenido = await pausarReloj(partido);
          partidosConRelojActivo.delete(partidoId);
          io.to(roomPartido(publicToken)).emit('estado', await construirEstado(detenido));
          continue;
        }
        io.to(roomPartido(publicToken)).emit('estado', await construirEstado(partido));
      } catch (error) {
        console.error('[tick reloj]', error);
      }
    }
  }, 1000);
}
