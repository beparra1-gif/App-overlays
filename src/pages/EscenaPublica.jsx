import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { crearSocket } from '../socket';
import VistaMarcador from '../marcadores/vistas/VistaMarcador';
import VistaNomina from '../marcadores/vistas/VistaNomina';
import VistaEstadisticas from '../marcadores/vistas/VistaEstadisticas';
import VistaAnuncios from '../marcadores/vistas/VistaAnuncios';
import ErrorBoundary from '../components/ErrorBoundary';
import { useCajaMarcador } from '../marcadores/utils';

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
  // Interruptor manual desde la Mesa (independiente de Nómina/Estadísticas)
  // — se queda así hasta que alguien lo vuelva a prender, sin temporizador.
  const [marcadorOculto, setMarcadorOculto] = useState(false);

  // Medida real de la caja del marcador, para que Anuncios pueda apilarse
  // sin pisar el título cuando los dos están activos (ver
  // config.anunciosTituloModo, más abajo). Se mide siempre (hook
  // incondicional, como pide React) sobre el contenedor de la escena
  // 'marcador' — en las otras 3 escenas dedicadas (nomina/estadisticas/
  // anuncios sueltas) el ref nunca se cuelga de nada, así que el hook
  // simplemente no mide nada, sin costo.
  const contenedorRef = useRef(null);
  const caja = useCajaMarcador(contenedorRef, [datos?.diseno?.plantilla_base, datos?.diseno?.config]);

  // Fondo transparente de verdad, sin depender de que el reproductor
  // soporte el selector CSS :has() (las reglas `html:has(...) {background:
  // transparent}` de cada plantilla dependen de eso) — muchas apps de
  // streaming para celular usan un WebView más viejo/limitado donde ese
  // selector simplemente no aplica, y como el <body> global (index.css)
  // siempre pinta su propio fondo (`background: var(--fondo)`), ese fondo
  // opaco gana y tapa la transparencia. Un estilo inline por JS (la
  // especificidad más alta que existe) funciona sea cual sea el motor.
  useEffect(() => {
    const raiz = document.documentElement;
    const cuerpo = document.body;
    raiz.style.background = 'transparent';
    cuerpo.style.background = 'transparent';
    return () => {
      raiz.style.background = '';
      cuerpo.style.background = '';
    };
  }, []);

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
    socket.on('marcador_visibilidad', ({ oculto }) => activo && setMarcadorOculto(!!oculto));
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

  // Solo hace falta saber "hay un aviso en pantalla ahora mismo" para el
  // modo 'reemplaza-titulo' (ver más abajo) — mismo patrón que
  // nómina/estadísticas de arriba, aproximado (no filtra por
  // anunciarFaltas como VistaAnuncios internamente sí hace) pero alcanza
  // para saber cuándo tapar el título.
  const ultimaJugada = jugadas[0];
  const duracionAnunciosMs = (Number(datos?.diseno?.config?.anunciosDuracionSeg) || 3.8) * 1000;
  const [anuncioVisible, setAnuncioVisible] = useState(false);
  useEffect(() => {
    if (!ultimaJugada) return undefined;
    setAnuncioVisible(true);
    const temporizador = setTimeout(() => setAnuncioVisible(false), duracionAnunciosMs);
    return () => clearTimeout(temporizador);
  }, [ultimaJugada?.ts, duracionAnunciosMs]);

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
      // debajo — antes siempre quedaba visible, sin poder elegir. Se suma el
      // interruptor manual (`marcadorOculto`, botón "Marcador Visible/
      // Oculto" en la Mesa) — cualquiera de los tres motivos alcanza para
      // tapar el marcador.
      const ocultarMarcadorAhora = Boolean((nomina && nomina.ocultarMarcador) || (stats && stats.ocultarMarcador) || marcadorOculto);
      // Modo "reemplazar el título por el anuncio" (Personalizar diseño →
      // Anuncios → Cómo convive con el título): mientras hay un aviso en
      // pantalla, el título se apaga del todo y el aviso ocupa exactamente
      // su lugar — ver TituloMarcador (prop `suprimir`) y VistaAnuncios
      // (modo 'reemplaza-titulo').
      const suprimirTitulo = cfg.anunciosTituloModo === 'reemplaza-titulo' && cfg.anunciarJugadas && anuncioVisible;
      return (
        <div ref={contenedorRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
          {/* Siempre montado (nunca se saca del DOM) — la animación de
              salida/entrada la hace VistaMarcador con opacity/scale según
              `oculto`; sacarlo de golpe con un `&&` condicional no dejaba
              lugar para ninguna transición. */}
          <ErrorBoundary>
            <VistaMarcador partido={datos.partido} diseno={datos.diseno} oculto={ocultarMarcadorAhora} suprimirTitulo={suprimirTitulo} />
          </ErrorBoundary>
          {cfg.mostrarNomina && nomina && (
            <ErrorBoundary>
              <VistaNomina key={nomina.ts} partido={datos.partido} modo={nomina.modo} claveAnimacion={nomina.ts} config={cfg} plantillaId={plantillaId} />
            </ErrorBoundary>
          )}
          {cfg.mostrarEstadisticas && stats && (
            <ErrorBoundary>
              <VistaEstadisticas
                key={stats.ts}
                partido={datos.partido}
                config={configEstadisticas(stats)}
                tema={cfg}
                plantillaId={plantillaId}
              />
            </ErrorBoundary>
          )}
          {cfg.anunciarJugadas && (
            <ErrorBoundary>
              <VistaAnuncios
                jugadas={jugadas}
                config={cfg}
                tema={cfg}
                plantillaId={plantillaId}
                colorLocal={datos.partido.equipoLocal?.color}
                colorVisita={datos.partido.equipoVisita?.color}
                caja={caja}
              />
            </ErrorBoundary>
          )}
        </div>
      );
    }
    case 'nomina':
      // Escena dedicada (no la compuesta arriba): se queda visible mientras
      // esté activa, sin ocultarse sola — es su propia fuente de OBS, el
      // interruptor de Mesa ya la prende/apaga.
      return (
        <ErrorBoundary>
          <VistaNomina partido={datos.partido} modo={nomina?.modo || 'ambos'} claveAnimacion={nomina?.ts || 0} config={datos.diseno?.config} plantillaId={datos.diseno?.plantilla_base} />
        </ErrorBoundary>
      );
    case 'estadisticas':
      return (
        <ErrorBoundary>
          <VistaEstadisticas partido={datos.partido} config={datos.escena.config} tema={datos.diseno?.config} plantillaId={datos.diseno?.plantilla_base} />
        </ErrorBoundary>
      );
    case 'anuncios':
      return (
        <ErrorBoundary>
          <VistaAnuncios
            jugadas={jugadas}
            config={datos.escena.config}
            tema={datos.diseno?.config}
            plantillaId={datos.diseno?.plantilla_base}
            colorLocal={datos.partido.equipoLocal?.color}
            colorVisita={datos.partido.equipoVisita?.color}
          />
        </ErrorBoundary>
      );
    default:
      return null;
  }
}
