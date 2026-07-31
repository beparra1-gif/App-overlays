import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { crearSocket } from '../socket';
import VistaMarcador from '../marcadores/vistas/VistaMarcador';
import VistaNomina from '../marcadores/vistas/VistaNomina';
import VistaEstadisticas from '../marcadores/vistas/VistaEstadisticas';
import VistaAnuncios from '../marcadores/vistas/VistaAnuncios';

// El payload que viaja por socket (stats_pulso) trae solo lo mínimo; acá se
// arma la config completa que espera VistaEstadisticas para cada uno de los
// 3 modos disparables desde la Mesa.
function configEstadisticas(stats) {
  if (stats.modo === 'jugador') return { modo: 'jugador', jugadorId: stats.jugadorId };
  if (stats.modo === 'ambos') return { modo: 'ambos', detalle: stats.detalle, puntosPorPeriodo: stats.puntosPorPeriodo };
  return { modo: 'equipo', equipo: stats.equipo, detalle: stats.detalle, puntosPorPeriodo: stats.puntosPorPeriodo };
}

export default function EscenaPublica() {
  const { token } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [nomina, setNomina] = useState(null);
  const [jugadas, setJugadas] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let activo = true;
    api
      .obtenerEscenaPublica(token)
      .then((d) => activo && setDatos(d))
      .catch((err) => activo && setError(err.message));

    const socket = crearSocket();
    socket.on('connect', () => socket.emit('unirse', { escenaToken: token }));
    socket.on('estado', (estado) => activo && setDatos((prev) => (prev ? { ...prev, partido: estado } : prev)));
    socket.on('escena_config', (d) => activo && setDatos((prev) => ({ ...(prev || {}), escena: d.escena, diseno: d.diseno })));
    socket.on('escena_actualizada', (escenaNueva) => activo && setDatos((prev) => (prev ? { ...prev, escena: escenaNueva } : prev)));
    // Cualquier cambio guardado en "Personalizar tablero" (colores, logo,
    // animaciones, lo que sea) llega acá al instante, sin recargar — el
    // usuario puede seguir ajustando el diseño con el partido ya en curso.
    socket.on('diseno_actualizado', (disenoNuevo) => activo && setDatos((prev) => (prev ? { ...prev, diseno: disenoNuevo } : prev)));
    socket.on('nomina_pulso', ({ modo, ocultarMarcador }) => activo && setNomina({ modo, ocultarMarcador, ts: Date.now() }));
    socket.on('jugada', (jugada) => activo && setJugadas((prev) => [jugada, ...prev].slice(0, 5)));
    socket.on('stats_pulso', (payload) => activo && setStats({ ...payload, ts: Date.now() }));
    socket.on('error_marcador', (payload) => activo && setError(payload.error));

    return () => {
      activo = false;
      socket.disconnect();
    };
  }, [token]);

  // Nómina y Estadísticas disparadas desde Mesa quedan un rato en pantalla y
  // se ocultan solas — así se piden "cuando hagan falta" sin quedar pegadas
  // tapando el marcador el resto del partido. Cuánto rato es cada una lo
  // elige el diseño (Personalizar diseño → segundos visible), con un
  // respaldo razonable si todavía no se configuró.
  const duracionNominaMs = (Number(datos?.diseno?.config?.nominaDuracionSeg) || 6) * 1000;
  const duracionStatsMs = (Number(datos?.diseno?.config?.estadisticasDuracionSeg) || 7) * 1000;
  useEffect(() => {
    if (!nomina) return undefined;
    const temporizador = setTimeout(() => setNomina(null), duracionNominaMs);
    return () => clearTimeout(temporizador);
  }, [nomina?.ts, duracionNominaMs]);
  useEffect(() => {
    if (!stats) return undefined;
    const temporizador = setTimeout(() => setStats(null), duracionStatsMs);
    return () => clearTimeout(temporizador);
  }, [stats?.ts, duracionStatsMs]);

  if (error || !datos?.partido || !datos?.escena) return null;
  if (datos.escena.eliminada || datos.escena.activo === false) return null;

  switch (datos.escena.tipo) {
    case 'marcador': {
      // Enlace único por diseño: el marcador compone encima suyo la Nómina
      // y las Estadísticas (ambas se activan "a demanda" con los botones ▶ /
      // 📊 de Mesa, y se ocultan solas después de unos segundos) y los
      // Anuncios (se activan solos con cada jugada) — cada una según lo que
      // ese diseño tenga habilitado en Personalizar diseño — así alcanza con
      // un solo enlace en OBS en vez de cuatro fuentes.
      const cfg = datos.diseno?.config || {};
      const plantillaId = datos.diseno?.plantilla_base;
      // Al disparar nómina/estadísticas desde la Mesa, el que dispara elige
      // (checkbox "Ocultar el marcador mientras se muestra") si el marcador
      // base se tapa mientras esa capa está en pantalla o se queda visible
      // debajo — antes siempre quedaba visible, sin poder elegir.
      const ocultarMarcadorAhora = Boolean((nomina && nomina.ocultarMarcador) || (stats && stats.ocultarMarcador));
      return (
        <>
          {/* Siempre montado (nunca se saca del DOM) — la animación de
              salida/entrada la hace VistaMarcador con opacity/scale según
              `oculto`; sacarlo de golpe con un `&&` condicional no dejaba
              lugar para ninguna transición. */}
          <VistaMarcador partido={datos.partido} diseno={datos.diseno} oculto={ocultarMarcadorAhora} />
          {cfg.mostrarNomina && nomina && (
            <VistaNomina key={nomina.ts} partido={datos.partido} modo={nomina.modo} claveAnimacion={nomina.ts} config={cfg} plantillaId={plantillaId} />
          )}
          {cfg.mostrarEstadisticas && stats && (
            <VistaEstadisticas
              key={stats.ts}
              partido={datos.partido}
              config={configEstadisticas(stats)}
              tema={cfg}
              plantillaId={plantillaId}
            />
          )}
          {cfg.anunciarJugadas && (
            <VistaAnuncios
              jugadas={jugadas}
              config={cfg}
              tema={cfg}
              plantillaId={plantillaId}
              colorLocal={datos.partido.equipoLocal?.color}
              colorVisita={datos.partido.equipoVisita?.color}
            />
          )}
        </>
      );
    }
    case 'nomina':
      // Escena dedicada (no la compuesta arriba): se queda visible mientras
      // esté activa, sin ocultarse sola — es su propia fuente de OBS, el
      // interruptor de Mesa ya la prende/apaga.
      return <VistaNomina partido={datos.partido} modo={nomina?.modo || 'ambos'} claveAnimacion={nomina?.ts || 0} config={datos.diseno?.config} plantillaId={datos.diseno?.plantilla_base} />;
    case 'estadisticas':
      return <VistaEstadisticas partido={datos.partido} config={datos.escena.config} tema={datos.diseno?.config} plantillaId={datos.diseno?.plantilla_base} />;
    case 'anuncios':
      return (
        <VistaAnuncios
          jugadas={jugadas}
          config={datos.escena.config}
          tema={datos.diseno?.config}
          plantillaId={datos.diseno?.plantilla_base}
          colorLocal={datos.partido.equipoLocal?.color}
          colorVisita={datos.partido.equipoVisita?.color}
        />
      );
    default:
      return null;
  }
}
