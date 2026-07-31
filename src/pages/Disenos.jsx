import { useEffect, useRef, useState } from 'react';
import { api, urlLogo } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PLANTILLAS_MARCADOR } from '../marcadores/registro';
import { PRESETS_POSICION, mostrar, FUENTES_DISPONIBLES } from '../marcadores/utils';
import MiniPreviewMarcador from '../marcadores/MiniPreviewMarcador';
import PreviaCombinada from '../marcadores/PreviaCombinada';
import EquipoFicha from '../components/EquipoFicha';
import SelectorLogo from '../components/SelectorLogo';
import Mesa from './Mesa';
import MesaSimple from './MesaSimple';

const CONFIG_INICIAL = {
  // Equipos y reglas del partido
  mostrarTitulo: false,
  tituloTexto: '',
  tituloTamano: 100,
  colorTitulo: '',
  colorTituloAlpha: 100,
  colorTituloTexto: '',
  colorTituloTextoAlpha: 100,
  mostrarReloj: true,
  minutosPeriodo: 10,
  minutosProrroga: 5,

  // Marcador
  colorTablero: '',
  colorBanner: '',
  colorMarcador: '',
  colorTexto: '',
  colorTableroAlpha: 100,
  colorBannerAlpha: 100,
  colorMarcadorAlpha: 100,
  colorTextoAlpha: 100,
  fuenteMarcador: '',
  tamanoTextoMarcador: 100,
  tamanoTextoNombre: 100,
  personalizadoForma: 'redondeada',
  personalizadoBorde: 'fino',
  mostrarLogo: true,
  logoPosicion: 'costado',
  logoCajaModo: 'dentro',
  logoTamanoMarcador: 40,
  logoCostadoTamano: 100,
  logoOpacidadMarcador: 100,
  logoTamanoFondo: 30,
  escala: 1,
  estiramientoAncho: 100,
  estiramientoAlto: 100,
  mostrarFaltas: true,
  estiloFaltas: 'numero',
  mostrarPosesion: true,
  mostrarAnimacionPuntos: true,
  animacionPuntosPosicion: 'costado',
  animacionPuntosTamano: 100,
  animacionPuntosEstilo: 'clasica',
  animacionPuntosConMano: false,
  animacionPuntosX: 50,
  animacionPuntosY: 50,

  // Nómina
  mostrarNomina: true,
  nominaPosicion: 'centro',
  nominaConEstadisticas: false,
  logoEnNomina: true,
  nominaLogoPosicion: 'costado',
  logoTamanoNomina: 40,
  logoOpacidadNomina: 100,
  nominaLogoFondoTamano: 130,
  nominaDuracionSeg: 6,

  // Estadísticas
  mostrarEstadisticas: true,
  estadisticasPosicion: 'centro',
  mostrarDetalleJugadores: false,
  logoEnEstadisticas: true,
  logoTamanoEstadisticas: 56,
  logoOpacidadEstadisticas: 100,
  estadisticasDuracionSeg: 7,

  // Anuncios
  anunciarJugadas: true,
  alertaPosicion: '',
  alertaAnimacion: '',
  anunciarFaltas: true,
  anunciosDuracionSeg: 4,

  // Logos libres (competencia/torneo/liga): posición y tamaño propios,
  // libres, sin atarse a ningún otro elemento del marcador.
  logosLibres: [],
};

const REF_ANCHO = 1920;
const REF_ALTO = 1080;

const OPCIONES_UBICACION = [
  { id: 'centro', etiqueta: 'Centro' },
  { id: 'arriba', etiqueta: 'Arriba' },
  { id: 'abajo', etiqueta: 'Abajo' },
  { id: 'izquierda', etiqueta: 'Izquierda' },
  { id: 'derecha', etiqueta: 'Derecha' },
];

// La nómina siempre arranca pegada arriba (ver VistaNomina.jsx) — el alto
// no es configurable a propósito, así que acá solo se ofrece el costado,
// para no mostrar un control "Arriba/Abajo" que no haría nada.
const OPCIONES_UBICACION_NOMINA = [
  { id: 'izquierda', etiqueta: 'Izquierda' },
  { id: 'centro', etiqueta: 'Centro' },
  { id: 'derecha', etiqueta: 'Derecha' },
];

const OPCIONES_ANIMACION_ANUNCIO = [
  { id: '', etiqueta: 'Automático según el diseño' },
  { id: 'clasico', etiqueta: 'Clásica (aparece con un zoom suave)' },
  { id: 'broadcast', etiqueta: 'Broadcast (desliza rápido desde el costado)' },
  { id: 'neon', etiqueta: 'Neón (parpadeo tipo cartel de luz)' },
  { id: 'streetball', etiqueta: 'Streetball (desliza inclinado con rebote)' },
  { id: 'cristal', etiqueta: 'Cristal (aparece difuminado)' },
];

function Toggle({ etiqueta, checked, onChange }) {
  return (
    <label className="toggle-switch">
      <span>{etiqueta}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function SelectorUbicacion({ etiqueta, valor, onChange, opciones = OPCIONES_UBICACION }) {
  return (
    <label>
      {etiqueta}
      <select value={valor || 'centro'} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
      </select>
    </label>
  );
}

// Cuántos segundos se queda en pantalla después de disparar el elemento
// (nómina/estadísticas/anuncios) antes de ocultarse solo — cada uno tiene el
// suyo, independiente de los demás, para poder dejar uno más rápido y otro
// más lento según haga falta.
function SelectorDuracion({ etiqueta, valor, porDefecto, onChange }) {
  const actual = Number.isFinite(valor) ? valor : porDefecto;
  return (
    <label>
      {etiqueta} ({actual}s)
      <input type="range" min={2} max={20} step={1} value={actual} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

const PESTANAS_PERSONALIZACION = [
  { id: 'equipos', etiqueta: 'Equipos', icono: '👕' },
  { id: 'marcador', etiqueta: 'Marcador', icono: '🏀' },
  { id: 'nomina', etiqueta: 'Nómina', icono: '👥' },
  { id: 'estadisticas', etiqueta: 'Estadísticas', icono: '📊' },
  { id: 'anuncios', etiqueta: 'Anuncios', icono: '📣' },
  { id: 'logos', etiqueta: 'Logos libres', icono: '🖼️' },
];

// La ficha de "Equipos" no tiene capa propia en pantalla — lo que se
// configura ahí (nombre, título, reloj) se ve todo DENTRO del marcador, así
// que la vista previa de esa pestaña es la misma que la de "Marcador". Los
// logos libres pueden ir en CUALQUIER zona de la pantalla (no solo cerca del
// tablero), así que su vista previa es siempre el lienzo completo ('general'),
// para poder ver y arrastrar sin que el zoom automático del marcador tape el
// resto del encuadre.
const PREVIA_MODO_POR_SECCION = { equipos: 'marcador', marcador: 'marcador', nomina: 'nomina', estadisticas: 'estadisticas', anuncios: 'anuncios', logos: 'general' };
const PREVIA_ETIQUETA = { general: 'Vista general', marcador: 'Marcador', nomina: 'Nómina', estadisticas: 'Estadísticas', anuncios: 'Anuncios' };

// Selector de color "que se entienda": swatch grande (clickeable, abre el
// picker nativo), el valor hex a la vista y una transparencia PROPIA de ese
// color — antes era una sola franja de <input type=color> sin más contexto,
// acá cada color se lee y se ajusta por separado.
function SelectorColor({ etiqueta, valor, alpha, porDefecto, onCambiarColor, onCambiarAlpha }) {
  const hex = (valor || porDefecto || '#000000').toUpperCase();
  return (
    <div className="selector-color">
      <div className="selector-color-fila">
        <input type="color" value={valor || porDefecto} onChange={(e) => onCambiarColor(e.target.value)} />
        <div className="selector-color-nombres">
          <span className="selector-color-etiqueta">{etiqueta}</span>
          <span className="selector-color-hex">{hex}</span>
        </div>
      </div>
      <label className="selector-color-alpha">
        Transparencia ({alpha}%)
        <input
          type="range"
          min={10}
          max={100}
          value={Number.isFinite(alpha) ? alpha : 100}
          onChange={(e) => onCambiarAlpha(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

// Mensaje de confirmación antes de borrar un diseño — distinto según si ese
// diseño tiene un partido activo (con su propio enlace de OBS ya en uso):
// borrar el diseño NUNCA borra ese enlace (la escena solo pierde el diseño,
// ver ON DELETE SET NULL en la base), pero el marcador de ESE enlace vuelve
// a verse en blanco al toque, y la próxima vez que se use esta plantilla se
// arma un diseño (y eventualmente un partido/enlace) nuevo de cero — nada de
// esto debe ser una sorpresa después de apretar Eliminar.
function mensajeConfirmarEliminar(diseno) {
  if (diseno?.partido_activo_id) {
    return `"${diseno.nombre}" tiene un partido en curso con su propio enlace de OBS. Si lo eliminás, ese enlace deja de mostrar este diseño (el marcador vuelve a verse en blanco) y la próxima vez que uses esta plantilla vas a armar un diseño y un enlace nuevos. Esta acción no se puede deshacer. ¿Eliminar igual?`;
  }
  return `¿Eliminar "${diseno.nombre}"? Esta acción no se puede deshacer.`;
}

function nombreAutomatico(plantillaBase) {
  const nombrePlantilla = PLANTILLAS_MARCADOR.find((p) => p.id === plantillaBase)?.nombre || 'Diseño';
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${nombrePlantilla} — ${fecha}`;
}

function FormularioDiseno({ inicial, onGuardar, onEliminar, onCancelar }) {
  const [plantillaBase] = useState(inicial?.plantilla_base || PLANTILLAS_MARCADOR[0].id);
  const [configRaw, setConfigRaw] = useState({ ...CONFIG_INICIAL, ...(inicial?.config || {}) });
  const [error, setError] = useState('');
  const [logos, setLogos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [nombrePreset, setNombrePreset] = useState('');
  const [seccionAbierta, setSeccionAbierta] = useState('equipos');
  // La vista previa sigue a la pestaña abierta (ver PREVIA_MODO_POR_SECCION)
  // — este interruptor es la salida manual para ver las 4 capas juntas como
  // se van a ver de verdad en la transmisión, sin cambiar de pestaña.
  const [previaGeneral, setPreviaGeneral] = useState(false);
  const [pestanaExterna, setPestanaExterna] = useState(inicial?._irADirecto || 'personalizar');
  // El partido de "Juego en vivo" se prepara solo (nunca hace falta pedirlo
  // a mano) y se queda guardado en este estado mientras la pantalla siga
  // abierta — cambiar de pestaña no lo vuelve a crear.
  const [partidoId, setPartidoId] = useState(null);
  const [preparandoPartido, setPreparandoPartido] = useState(false);
  const [errorPartido, setErrorPartido] = useState('');
  // Mesa amplia (todo: plantel, disparos de transmisión) o simple (solo
  // puntaje/reloj/faltas/tiempos fuera) — se recuerda entre visitas porque
  // suele ser una preferencia de LA PERSONA que anota, no del partido.
  const [mesaModo, setMesaModo] = useState(() => localStorage.getItem('app_overlays_mesa_modo') || 'amplia');
  useEffect(() => { localStorage.setItem('app_overlays_mesa_modo', mesaModo); }, [mesaModo]);
  // Si este diseño ya tiene un partido activo (se reabrió con algo en
  // curso), acá se trae el equipo REAL con el que se está jugando — así la
  // ficha de "Equipos" no vuelve a mostrar "Local"/"Visita" en blanco.
  const [equipoLocalActivo, setEquipoLocalActivo] = useState(null);
  const [equipoVisitaActivo, setEquipoVisitaActivo] = useState(null);
  const [cargandoEquiposActivos, setCargandoEquiposActivos] = useState(Boolean(inicial?.partido_activo_id));
  // Lo que se está tipeando/eligiendo AHORA en la ficha de cada equipo
  // (nombre/color/logo) — alimenta la vista previa combinada en vivo, con
  // los datos reales en vez de un selector de "equipo de muestra" aparte.
  const [equipoLocalVivo, setEquipoLocalVivo] = useState(null);
  const [equipoVisitaVivo, setEquipoVisitaVivo] = useState(null);
  // Estado EN VIVO del partido embebido en "Juego en vivo" (Mesa lo reporta
  // por su propio callback, sin abrir una segunda conexión de socket) — si
  // ya hay un partido preparado, la vista previa de "Personalizar tablero"
  // lo usa en vez de datos de muestra, para ver el diseño con el marcador
  // real mientras se lo sigue ajustando.
  const [partidoEnVivo, setPartidoEnVivo] = useState(null);
  const equipoLocalRef = useRef(null);
  const equipoVisitaRef = useRef(null);

  useEffect(() => { api.listarLogos().then((d) => setLogos(d.logos)).catch(() => {}); }, []);
  useEffect(() => { api.listarEquipos().then((d) => setEquipos(d.equipos)).catch(() => {}); }, []);
  useEffect(() => { api.listarPosiciones().then((d) => setPosiciones(d.posiciones)).catch(() => {}); }, []);

  useEffect(() => {
    let activo = true;
    if (!inicial?.partido_activo_id) { setCargandoEquiposActivos(false); return undefined; }
    api.obtenerPartido(inicial.partido_activo_id)
      .then((d) => {
        if (!activo) return;
        setEquipoLocalActivo(d.partido.equipoLocal);
        setEquipoVisitaActivo(d.partido.equipoVisita);
      })
      .catch(() => {})
      .finally(() => { if (activo) setCargandoEquiposActivos(false); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deshacer/rehacer sobre `config`: cada cambio empuja el estado anterior a
  // la pila; Ctrl+Z / Ctrl+Shift+Z navegan sin tocar el servidor — todo vive
  // en memoria hasta que se guarda el diseño.
  const historialRef = useRef([]);
  const futuroRef = useRef([]);
  const config = configRaw;
  const setConfig = (actualizador) => {
    setConfigRaw((actual) => {
      const nuevo = typeof actualizador === 'function' ? actualizador(actual) : actualizador;
      if (nuevo !== actual) {
        historialRef.current.push(actual);
        if (historialRef.current.length > 60) historialRef.current.shift();
        futuroRef.current = [];
      }
      return nuevo;
    });
  };
  const deshacer = () => {
    if (historialRef.current.length === 0) return;
    setConfigRaw((actual) => {
      const anterior = historialRef.current.pop();
      futuroRef.current.push(actual);
      return anterior;
    });
  };
  const rehacer = () => {
    if (futuroRef.current.length === 0) return;
    setConfigRaw((actual) => {
      const siguiente = futuroRef.current.pop();
      historialRef.current.push(actual);
      return siguiente;
    });
  };
  useEffect(() => {
    const alPresionar = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) rehacer(); else deshacer();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);

  const cambiarConfig = (clave, valor) => setConfig((c) => ({ ...c, [clave]: valor }));

  // Logos libres: se guardan y se leen siempre desde config.logosLibres —
  // agregar/editar/borrar son todo variaciones de "reemplazar el array
  // entero", así que no hace falta un estado aparte.
  const logosLibres = Array.isArray(config.logosLibres) ? config.logosLibres : [];
  const agregarLogoLibre = (logoUrl) => {
    if (!logoUrl) return;
    const nuevo = { id: `logo-${Date.now()}-${Math.random().toString(36).slice(2)}`, logoUrl, xPercent: 50, yPercent: 50, anchoPercent: 15, opacidad: 100 };
    cambiarConfig('logosLibres', [...logosLibres, nuevo]);
  };
  const actualizarLogoLibre = (id, cambios) => {
    cambiarConfig('logosLibres', logosLibres.map((l) => (l.id === id ? { ...l, ...cambios } : l)));
  };
  const eliminarLogoLibre = (id) => cambiarConfig('logosLibres', logosLibres.filter((l) => l.id !== id));

  const posX = Number.isFinite(config.posX) ? config.posX : 50;
  const posY = Number.isFinite(config.posY) ? config.posY : 88;
  // "Restablecer" (más abajo) borra `escala` del config a propósito, igual
  // que posX/posY, para que la plantilla vuelva a su propio tamaño por
  // defecto — pero acá en el panel necesitamos SIEMPRE un número para
  // mostrar el % y controlar el slider (si no, "NaN%" y el control queda
  // sin dueño).
  const escalaActual = Number.isFinite(config.escala) ? config.escala : 1;
  const estiramientoAnchoActual = Number.isFinite(config.estiramientoAncho) ? config.estiramientoAncho : 100;
  const estiramientoAltoActual = Number.isFinite(config.estiramientoAlto) ? config.estiramientoAlto : 100;
  const centrado = Math.abs(posX - 50) < 3 && Math.abs(posY - 50) < 3;
  const restablecerPosicion = () => setConfig((c) => {
    const { posX: _x, posY: _y, escala: _e, estiramientoAncho: _ea, estiramientoAlto: _eal, ...resto } = c;
    return resto;
  });
  const restablecerColores = () => setConfig((c) => ({
    ...c,
    colorTablero: '', colorBanner: '', colorMarcador: '', colorTexto: '',
    colorTableroAlpha: 100, colorBannerAlpha: 100, colorMarcadorAlpha: 100, colorTextoAlpha: 100,
  }));
  const restablecerTamanosTexto = () => setConfig((c) => ({ ...c, tamanoTextoMarcador: 100, tamanoTextoNombre: 100 }));

  // Referencia fija de 1920×1080 (Full HD, el tamaño típico de canvas en
  // OBS) solo para traducir el arrastre en % a píxeles legibles y viceversa
  // — lo que se guarda sigue siendo % (responsive), pero se edita en px.
  const pxIzquierda = Math.round((posX / 100) * REF_ANCHO);
  const pxAbajo = Math.round(((100 - posY) / 100) * REF_ALTO);
  const moverPx = (deltaXpx, deltaYpx) => {
    setConfig((c) => {
      const x0 = Number.isFinite(c.posX) ? c.posX : 50;
      const y0 = Number.isFinite(c.posY) ? c.posY : 88;
      const nuevoXpx = Math.max(0, Math.min(REF_ANCHO, (x0 / 100) * REF_ANCHO + deltaXpx));
      const nuevoYpxAbajo = Math.max(0, Math.min(REF_ALTO, ((100 - y0) / 100) * REF_ALTO + deltaYpx));
      return { ...c, posX: (nuevoXpx / REF_ANCHO) * 100, posY: 100 - (nuevoYpxAbajo / REF_ALTO) * 100 };
    });
  };
  const fijarPx = (izquierdaPx, abajoPx) => {
    if (Number.isFinite(izquierdaPx)) moverPx(izquierdaPx - pxIzquierda, 0);
    if (Number.isFinite(abajoPx)) moverPx(0, abajoPx - pxAbajo);
  };

  // Presets de posición+tamaño, guardados aparte de los colores — quedan en
  // la cuenta (no en el navegador) y se pueden aplicar a cualquier diseño
  // para no repetir el ajuste fino cada vez.
  const [guardandoPreset, setGuardandoPreset] = useState(false);
  const guardarPresetActual = async () => {
    if (!nombrePreset.trim()) return;
    setGuardandoPreset(true);
    try {
      const { posicion } = await api.crearPosicion({ nombre: nombrePreset.trim(), pos_x: posX, pos_y: posY, escala: config.escala });
      setPosiciones((lista) => [posicion, ...lista]);
      setNombrePreset('');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoPreset(false);
    }
  };
  const aplicarPreset = (p) => setConfig((c) => ({ ...c, posX: p.pos_x, posY: p.pos_y, escala: p.escala }));
  const eliminarPreset = async (id) => {
    try {
      await api.eliminarPosicion(id);
      setPosiciones((lista) => lista.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  // El nombre ya no se pide: se autogenera (plantilla + fecha) la primera
  // vez y después se conserva tal cual en cada edición. El guardado tampoco
  // se pide: cada cambio de `config` se autoguarda solo (ver el useEffect
  // de más abajo) — `guardarAhora` es el punto único por el que pasa
  // cualquier guardado (autosave o "Crear partido y empezar" a demanda), con
  // un candado para que dos guardados no salgan disparados a la vez y creen
  // el diseño duplicado.
  const configRef = useRef(config);
  configRef.current = config;
  const guardadoEnVueloRef = useRef(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const guardarAhora = () => {
    if (guardadoEnVueloRef.current) return guardadoEnVueloRef.current;
    const promesa = (async () => {
      setGuardando(true);
      setError('');
      try {
        const diseno = await onGuardar({ nombre: inicial?.nombre || nombreAutomatico(plantillaBase), plantilla_base: plantillaBase, config: configRef.current });
        setGuardadoOk(true);
        setTimeout(() => setGuardadoOk(false), 1500);
        return diseno;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setGuardando(false);
        guardadoEnVueloRef.current = null;
      }
    })();
    guardadoEnVueloRef.current = promesa;
    return promesa;
  };

  // Autoguardado: cada cambio en `config` dispara un guardado a los 700ms de
  // quietud (evita mandar un pedido por cada tecla/slider). Se salta el
  // primer render (no hay nada nuevo que guardar apenas se abre la pantalla).
  const primerRenderRef = useRef(true);
  useEffect(() => {
    if (primerRenderRef.current) {
      primerRenderRef.current = false;
      return undefined;
    }
    const temporizador = setTimeout(() => { guardarAhora().catch(() => {}); }, 700);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const restablecerPreferencias = () => {
    if (!window.confirm('¿Restablecer todas las preferencias de este diseño a los valores originales de la plantilla?')) return;
    setConfig(CONFIG_INICIAL);
  };

  const eliminarDesdeAqui = async () => {
    if (!inicial?.id) return;
    if (!window.confirm(mensajeConfirmarEliminar(inicial))) return;
    setError('');
    try {
      await onEliminar(inicial.id);
    } catch (err) {
      setError(err.message);
    }
  };

  // Arma (o reusa) los equipos escritos en la pestaña "Equipos" y crea el
  // partido — se dispara solo apenas hace falta (ver el useEffect de abajo),
  // nunca hay que pedirlo a mano ni "confirmar". El diseño ya se autoguarda
  // por su cuenta, pero por las dudas se espera cualquier guardado pendiente
  // antes de crear el partido, para tener siempre un id real que referenciar.
  const prepararPartido = async () => {
    setErrorPartido('');
    setPreparandoPartido(true);
    try {
      // Si había un nombre/color/logo recién tipeado todavía esperando el
      // guardado en segundo plano (hasta 500ms de margen), acá se fuerza a
      // guardarlo YA — así Mesa y el marcador real nunca arrancan mirando
      // un equipo con datos viejos por una carrera contra ese guardado.
      const [disenoGuardado] = await Promise.all([
        guardarAhora(),
        equipoLocalRef.current?.guardarAhora(),
        equipoVisitaRef.current?.guardarAhora(),
      ]);
      const [local, visita] = await Promise.all([equipoLocalRef.current.obtener(), equipoVisitaRef.current.obtener()]);
      if (!local || !visita) throw new Error('Ponele un nombre a cada equipo');
      // El quinteto inicial ya no se elige acá — se elige en la Mesa de
      // control, donde se puede volver a ajustar en cualquier momento (por
      // ejemplo al empezar cada cuarto), así que el partido arranca sin
      // nadie en cancha todavía.
      const { partido } = await api.crearPartido({
        equipo_local_id: local.id,
        equipo_visita_id: visita.id,
        quinteto_local_ids: [],
        quinteto_visita_ids: [],
        diseno_id: disenoGuardado?.id || inicial?.id || null,
      });
      setPartidoId(partido.id);
    } catch (err) {
      setErrorPartido(err.message);
    } finally {
      setPreparandoPartido(false);
    }
  };

  // "Juego en vivo" nunca debe pedir un click de "crear partido": apenas se
  // entra a esa pestaña (y no hay uno ya preparado), se arma solo. Cambiar
  // de pestaña y volver reusa el mismo partido — no crea uno nuevo cada vez.
  useEffect(() => {
    if (pestanaExterna !== 'jugar') return;
    if (!partidoId && !preparandoPartido && !errorPartido) {
      prepararPartido();
      return;
    }
    // Si el partido ya existía (no es la primera vez que se entra acá en
    // esta visita), igual hay que asegurarse de que cualquier nombre/color/
    // logo recién tipeado en "Equipos" ya haya llegado al servidor antes de
    // mirar la Mesa — si no, se podía ver un instante el dato viejo hasta
    // que el guardado de fondo (hasta 500ms) terminara solo.
    equipoLocalRef.current?.guardarAhora();
    equipoVisitaRef.current?.guardarAhora();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaExterna]);

  return (
    <div className="tarjeta" style={{ marginBottom: 20 }}>
      <div className="fila-form" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{inicial?.id ? 'Editar diseño' : 'Personalizar diseño'}</h3>
        <div className="fila-form" style={{ margin: 0 }}>
          <span className="texto-tenue" style={{ fontSize: 13, minWidth: 76, textAlign: 'right' }}>
            {guardando ? 'Guardando…' : guardadoOk ? 'Guardado ✓' : ''}
          </span>
          <button type="button" className="btn-link" onClick={onCancelar}>← Volver al catálogo</button>
          {inicial?.id && (
            <button
              type="button"
              className="btn-link"
              title="Borra este diseño para siempre — si querés solo volver a los colores originales, usá Restablecer más abajo"
              onClick={eliminarDesdeAqui}
            >
              🗑️ Eliminar definitivamente
            </button>
          )}
          <button type="button" className="btn-secundario" title="Deshacer (Ctrl+Z)" disabled={historialRef.current.length === 0} onClick={deshacer}>↶ Deshacer</button>
          <button type="button" className="btn-secundario" title="Rehacer (Ctrl+Shift+Z)" disabled={futuroRef.current.length === 0} onClick={rehacer}>↷ Rehacer</button>
        </div>
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      <p className="texto-tenue" style={{ margin: '0 0 10px', fontSize: 12 }}>Se guarda solo, sin botón.</p>

      <div className="pestanas-personalizacion" style={{ marginBottom: 16 }}>
        <button type="button" className={`pestana-btn ${pestanaExterna === 'personalizar' ? 'activa' : ''}`} onClick={() => setPestanaExterna('personalizar')}>
          🎨 Personalizar tablero
        </button>
        <button type="button" className={`pestana-btn ${pestanaExterna === 'jugar' ? 'activa' : ''}`} onClick={() => setPestanaExterna('jugar')}>
          🏀 Juego en vivo (Mesa de control)
        </button>
      </div>

      {/* Los dos paneles quedan siempre montados (se ocultan con `hidden`,
          no con un `if`/ternario) — así cambiar de pestaña es instantáneo
          para los dos lados: ni se pierden las referencias a EquipoFicha, ni
          se desconecta el socket de la Mesa embebida cada vez que mirás
          "Personalizar tablero" un segundo. */}
      <div className="grupo-personalizacion" hidden={pestanaExterna !== 'jugar'}>
        <div className="fila-form" style={{ justifyContent: 'space-between' }}>
          <div className="grupo-titulo" style={{ margin: 0 }}>🏀 Juego en vivo</div>
          {partidoId && (
            <div className="pestanas-personalizacion" style={{ margin: 0, maxWidth: 320 }}>
              <button type="button" className={`pestana-btn ${mesaModo === 'amplia' ? 'activa' : ''}`} onClick={() => setMesaModo('amplia')}>
                Mesa amplia
              </button>
              <button type="button" className={`pestana-btn ${mesaModo === 'simple' ? 'activa' : ''}`} onClick={() => setMesaModo('simple')}>
                Mesa simple
              </button>
            </div>
          )}
        </div>
        {preparandoPartido && <p className="texto-tenue">Preparando el partido…</p>}
        {errorPartido && (
          <>
            <p className="mensaje-error">{errorPartido}</p>
            <button className="btn-secundario" onClick={prepararPartido}>Reintentar</button>
          </>
        )}
        {partidoId && mesaModo === 'amplia' && <Mesa partidoId={partidoId} embebido onPartidoCambio={setPartidoEnVivo} />}
        {partidoId && mesaModo === 'simple' && <MesaSimple partidoId={partidoId} embebido onPartidoCambio={setPartidoEnVivo} />}
      </div>

      <div hidden={pestanaExterna !== 'personalizar'}>
        <div style={{ marginBottom: 18 }}>
          <div className="previa-cabecera">
            <span className="previa-etiqueta">
              {previaGeneral ? 'Vista general' : PREVIA_ETIQUETA[PREVIA_MODO_POR_SECCION[seccionAbierta]]}
              {partidoEnVivo && <span className="chip-en-uso" style={{ marginLeft: 8 }}>● en vivo</span>}
            </span>
            <button type="button" className="btn-secundario btn-chico" onClick={() => setPreviaGeneral((v) => !v)}>
              {previaGeneral ? 'Ver solo esto' : 'Ver todo junto'}
            </button>
          </div>
          <PreviaCombinada
            plantillaId={plantillaBase}
            config={config}
            equipoLocalPreview={equipoLocalVivo}
            equipoVisitaPreview={equipoVisitaVivo}
            partidoReal={partidoEnVivo}
            modo={previaGeneral ? 'general' : PREVIA_MODO_POR_SECCION[seccionAbierta]}
            logosLibresEditable={seccionAbierta === 'logos'}
            onArrastrarLogoLibre={(id, x, y) => actualizarLogoLibre(id, { xPercent: x, yPercent: y })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="texto-tenue" style={{ margin: '0 0 10px' }}>
            Plantilla: <strong>{PLANTILLAS_MARCADOR.find((p) => p.id === plantillaBase)?.nombre}</strong>
          </p>

            <div className="pestanas-personalizacion">
              {PESTANAS_PERSONALIZACION.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`pestana-btn ${seccionAbierta === p.id ? 'activa' : ''}`}
                  onClick={() => setSeccionAbierta(p.id)}
                >
                  {p.icono} {p.etiqueta}
                </button>
              ))}
            </div>

            {/* ───────── EQUIPOS ───────── */}
            <div className="grupo-personalizacion" hidden={seccionAbierta !== 'equipos'}>
              <div className="grupo-titulo">👕 Equipos y reglas del partido</div>
              <div className="grilla-dos-columnas" style={{ marginBottom: 10 }}>
                {cargandoEquiposActivos ? (
                  <>
                    <p className="texto-tenue">Cargando equipo local…</p>
                    <p className="texto-tenue">Cargando equipo visita…</p>
                  </>
                ) : (
                  <>
                    <EquipoFicha
                      ref={equipoLocalRef}
                      titulo="Local"
                      valorDefecto="Local"
                      equipoActivo={equipoLocalActivo}
                      equipos={equipos}
                      logos={logos}
                      onLogoSubido={(l) => setLogos((prev) => [l, ...prev])}
                      onEquipoCreado={(eq) => setEquipos((prev) => (prev.some((e) => e.id === eq.id) ? prev.map((e) => (e.id === eq.id ? eq : e)) : [...prev, eq]))}
                      onCambio={setEquipoLocalVivo}
                    />
                    <EquipoFicha
                      ref={equipoVisitaRef}
                      titulo="Visita"
                      valorDefecto="Visita"
                      equipoActivo={equipoVisitaActivo}
                      equipos={equipos}
                      logos={logos}
                      onLogoSubido={(l) => setLogos((prev) => [l, ...prev])}
                      onEquipoCreado={(eq) => setEquipos((prev) => (prev.some((e) => e.id === eq.id) ? prev.map((e) => (e.id === eq.id ? eq : e)) : [...prev, eq]))}
                      onCambio={setEquipoVisitaVivo}
                    />
                  </>
                )}
              </div>
              <p className="texto-tenue" style={{ margin: '0 0 10px' }}>
                Opcional — sin nómina, se juega "Local" vs "Visita". Los cambios se ven al instante en la transmisión.
              </p>
            </div>

            {/* ───────── MARCADOR ───────── */}
        <div className="grupo-personalizacion" hidden={seccionAbierta !== 'marcador'}>
          <div className="grupo-titulo">🏀 Marcador</div>

          {plantillaBase === 'personalizado' && (
            <>
              <p className="seccion-titulo">Forma</p>
              <div className="subgrupo">
                <label>
                  Forma de la caja
                  <select value={config.personalizadoForma || 'redondeada'} onChange={(e) => cambiarConfig('personalizadoForma', e.target.value)}>
                    <option value="redondeada">Redondeada</option>
                    <option value="cuadrada">Cuadrada</option>
                    <option value="pildora">Píldora (bien redondeada en los extremos)</option>
                  </select>
                </label>
                <label>
                  Borde
                  <select value={config.personalizadoBorde || 'fino'} onChange={(e) => cambiarConfig('personalizadoBorde', e.target.value)}>
                    <option value="ninguno">Sin borde</option>
                    <option value="fino">Fino</option>
                    <option value="grueso">Grueso</option>
                    <option value="glow">Con brillo (glow)</option>
                  </select>
                </label>
                <p className="texto-tenue" style={{ margin: 0, fontSize: 12 }}>
                  El resto (colores, fuente, tamaños, logo, posición) se ajusta igual que en cualquier otra plantilla, más abajo.
                </p>
              </div>
            </>
          )}

          <p className="seccion-titulo">Colores</p>
          <div className="fila-form" style={{ alignItems: 'stretch' }}>
            <SelectorColor
              etiqueta="Tablero"
              valor={config.colorTablero}
              alpha={config.colorTableroAlpha}
              porDefecto="#0a0c12"
              onCambiarColor={(v) => cambiarConfig('colorTablero', v)}
              onCambiarAlpha={(v) => cambiarConfig('colorTableroAlpha', v)}
            />
            <SelectorColor
              etiqueta="Banner"
              valor={config.colorBanner}
              alpha={config.colorBannerAlpha}
              porDefecto="#ffb703"
              onCambiarColor={(v) => cambiarConfig('colorBanner', v)}
              onCambiarAlpha={(v) => cambiarConfig('colorBannerAlpha', v)}
            />
            <SelectorColor
              etiqueta="Marcador"
              valor={config.colorMarcador}
              alpha={config.colorMarcadorAlpha}
              porDefecto="#ffffff"
              onCambiarColor={(v) => cambiarConfig('colorMarcador', v)}
              onCambiarAlpha={(v) => cambiarConfig('colorMarcadorAlpha', v)}
            />
            <SelectorColor
              etiqueta="Texto"
              valor={config.colorTexto}
              alpha={config.colorTextoAlpha}
              porDefecto="#ffffff"
              onCambiarColor={(v) => cambiarConfig('colorTexto', v)}
              onCambiarAlpha={(v) => cambiarConfig('colorTextoAlpha', v)}
            />
          </div>
          <button type="button" className="btn-link" style={{ alignSelf: 'flex-start', margin: '0 0 10px' }} onClick={restablecerColores}>
            Restablecer colores
          </button>

          <p className="seccion-titulo">Tipografía</p>
          <label>
            Tipo de letra del marcador (y de nómina/estadísticas/anuncios, para que todo combine)
            <select value={config.fuenteMarcador || ''} onChange={(e) => cambiarConfig('fuenteMarcador', e.target.value)}>
              {FUENTES_DISPONIBLES.map((f) => <option key={f.id} value={f.id}>{f.etiqueta}</option>)}
            </select>
          </label>

          <p className="seccion-titulo">Tamaño de los textos</p>
          <div className="fila-form">
            <label>Números del marcador ({config.tamanoTextoMarcador}%)
              <input type="range" min={60} max={220} value={config.tamanoTextoMarcador} onChange={(e) => cambiarConfig('tamanoTextoMarcador', Number(e.target.value))} />
            </label>
            <label>Nombre de los equipos ({config.tamanoTextoNombre}%)
              <input type="range" min={60} max={220} value={config.tamanoTextoNombre} onChange={(e) => cambiarConfig('tamanoTextoNombre', Number(e.target.value))} />
            </label>
          </div>
          <button type="button" className="btn-link" style={{ alignSelf: 'flex-start', margin: '0 0 10px' }} onClick={restablecerTamanosTexto}>
            Restablecer tamaños de texto
          </button>

          <p className="seccion-titulo">Título del marcador</p>
          <Toggle etiqueta="Mostrar título" checked={config.mostrarTitulo} onChange={(v) => cambiarConfig('mostrarTitulo', v)} />
          {config.mostrarTitulo && (
            <div className="subgrupo">
              <label>
                Texto del título
                <input
                  value={config.tituloTexto || ''}
                  onChange={(e) => cambiarConfig('tituloTexto', e.target.value)}
                  placeholder="Ej: Semifinal — Liga Regional 2026"
                  maxLength={60}
                />
              </label>
              <label>
                Tamaño de la pestaña ({config.tituloTamano || 100}%)
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={Number.isFinite(config.tituloTamano) ? config.tituloTamano : 100}
                  onChange={(e) => cambiarConfig('tituloTamano', Number(e.target.value))}
                />
              </label>
              <div className="fila-form" style={{ alignItems: 'stretch' }}>
                <SelectorColor
                  etiqueta="Fondo de la pestaña"
                  valor={config.colorTitulo}
                  alpha={config.colorTituloAlpha}
                  porDefecto="#ffb703"
                  onCambiarColor={(v) => cambiarConfig('colorTitulo', v)}
                  onCambiarAlpha={(v) => cambiarConfig('colorTituloAlpha', v)}
                />
                <SelectorColor
                  etiqueta="Letras"
                  valor={config.colorTituloTexto}
                  alpha={config.colorTituloTextoAlpha}
                  porDefecto="#0a0c12"
                  onCambiarColor={(v) => cambiarConfig('colorTituloTexto', v)}
                  onCambiarAlpha={(v) => cambiarConfig('colorTituloTextoAlpha', v)}
                />
              </div>
              <p className="texto-tenue" style={{ margin: 0 }}>Si no tocás el color, usa el mismo tono del Banner de arriba.</p>
            </div>
          )}

          <p className="seccion-titulo">Reloj de juego</p>
          <Toggle etiqueta="Mostrar reloj" checked={config.mostrarReloj} onChange={(v) => cambiarConfig('mostrarReloj', v)} />
          <div className="fila-form" style={{ marginTop: 8 }}>
            <label>Minutos por período
              <input
                type="number"
                min={1}
                max={20}
                value={Number.isFinite(config.minutosPeriodo) ? config.minutosPeriodo : 10}
                onChange={(e) => cambiarConfig('minutosPeriodo', Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 70 }}
              />
            </label>
            <label>Minutos por tiempo extra
              <input
                type="number"
                min={1}
                max={20}
                value={Number.isFinite(config.minutosProrroga) ? config.minutosProrroga : 5}
                onChange={(e) => cambiarConfig('minutosProrroga', Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 70 }}
              />
            </label>
          </div>
          <p className="texto-tenue" style={{ margin: '6px 0 0' }}>Define la duración real del reloj, no solo la apariencia.</p>

          <p className="seccion-titulo">Logo en el marcador</p>
          <Toggle etiqueta="Logo del equipo" checked={config.mostrarLogo} onChange={(v) => cambiarConfig('mostrarLogo', v)} />
          {config.mostrarLogo && (
            <div className="subgrupo">
              <div className="fila-form">
                <label>Tamaño ({config.logoTamanoMarcador}px)
                  <input type="range" min={20} max={180} value={config.logoTamanoMarcador} onChange={(e) => cambiarConfig('logoTamanoMarcador', Number(e.target.value))} />
                </label>
                <label>Transparencia ({config.logoOpacidadMarcador}%)
                  <input type="range" min={10} max={100} value={config.logoOpacidadMarcador} onChange={(e) => cambiarConfig('logoOpacidadMarcador', Number(e.target.value))} />
                </label>
              </div>
              <label>
                Posición del logo en el marcador
                <select value={config.logoPosicion || 'costado'} onChange={(e) => cambiarConfig('logoPosicion', e.target.value)}>
                  <option value="costado">Dentro del marcador (junto al nombre del equipo)</option>
                  <option value="arriba">Arriba del marcador</option>
                  <option value="abajo">Abajo del marcador</option>
                  <option value="costados">A los costados, afuera del marcador (uno a cada lado)</option>
                  <option value="fondo">Marca de agua, detrás de todo el marcador</option>
                </select>
              </label>
              {(config.logoPosicion === 'arriba' || config.logoPosicion === 'abajo' || config.logoPosicion === 'costados') && (
                <label>
                  Cómo se ve
                  <select value={config.logoCajaModo || 'dentro'} onChange={(e) => cambiarConfig('logoCajaModo', e.target.value)}>
                    <option value="dentro">Dentro de la caja (el marcador se ve más alto, pegado)</option>
                    <option value="fuera">Fuera de la caja (flotando cerca, sin fondo)</option>
                  </select>
                </label>
              )}
              {config.logoPosicion === 'costados' && (config.logoCajaModo || 'dentro') === 'dentro' && (
                <label>
                  Tamaño de la burbuja del costado ({config.logoCostadoTamano || 100}%)
                  <input
                    type="range" min={50} max={200} step={10}
                    value={Number.isFinite(config.logoCostadoTamano) ? config.logoCostadoTamano : 100}
                    onChange={(e) => cambiarConfig('logoCostadoTamano', Number(e.target.value))}
                  />
                </label>
              )}
              {config.logoPosicion === 'fondo' && (
                <>
                  <label>Tamaño de la marca de agua ({config.logoTamanoFondo}% del ancho de la caja)
                    <input type="range" min={15} max={90} value={config.logoTamanoFondo} onChange={(e) => cambiarConfig('logoTamanoFondo', Number(e.target.value))} />
                  </label>
                  <p className="texto-tenue" style={{ margin: 0 }}>Si tapa los números, bajá la transparencia (30-40%).</p>
                </>
              )}
            </div>
          )}

          <p className="seccion-titulo">Posición y tamaño del marcador</p>
          <p className="texto-tenue" style={{ margin: '0 0 4px' }}>Px desde la esquina inferior izquierda (1920×1080).</p>
          <div className="fila-form">
            <label>Desde la izquierda (px)
              <div className="fila-form" style={{ gap: 4 }}>
                <button type="button" className="btn-secundario" onClick={() => moverPx(-10, 0)}>−</button>
                <input
                  type="number"
                  value={pxIzquierda}
                  onChange={(e) => fijarPx(e.target.value === '' ? pxIzquierda : Number(e.target.value), undefined)}
                  style={{ width: 70 }}
                />
                <button type="button" className="btn-secundario" onClick={() => moverPx(10, 0)}>+</button>
              </div>
            </label>
            <label>Desde abajo (px)
              <div className="fila-form" style={{ gap: 4 }}>
                <button type="button" className="btn-secundario" onClick={() => moverPx(0, -10)}>−</button>
                <input
                  type="number"
                  value={pxAbajo}
                  onChange={(e) => fijarPx(undefined, e.target.value === '' ? pxAbajo : Number(e.target.value))}
                  style={{ width: 70 }}
                />
                <button type="button" className="btn-secundario" onClick={() => moverPx(0, 10)}>+</button>
              </div>
            </label>
          </div>
          <label>
            Tamaño general ({Math.round(escalaActual * 100)}%)
            <input type="range" min={0.5} max={2.6} step={0.05} value={escalaActual} onChange={(e) => cambiarConfig('escala', Number(e.target.value))} />
          </label>
          <div className="fila-form">
            <label>Ensanchar (ancho, {estiramientoAnchoActual}%)
              <input type="range" min={50} max={200} value={estiramientoAnchoActual} onChange={(e) => cambiarConfig('estiramientoAncho', Number(e.target.value))} />
            </label>
            <label>Alargar (alto, {estiramientoAltoActual}%)
              <input type="range" min={50} max={200} value={estiramientoAltoActual} onChange={(e) => cambiarConfig('estiramientoAlto', Number(e.target.value))} />
            </label>
          </div>
          <div className="fila-form" style={{ margin: '4px 0' }}>
            <span className="texto-tenue">{centrado && 'Centrado ✓'}</span>
            {PRESETS_POSICION.map((p) => (
              <button key={p.id} type="button" className="btn-secundario" onClick={() => setConfig((c) => ({ ...c, posX: p.x, posY: p.y }))}>
                {p.etiqueta}
              </button>
            ))}
            <button type="button" className="btn-link" onClick={restablecerPosicion}>Restablecer</button>
          </div>

          {posiciones.length > 0 && (
            <div className="fila-form" style={{ flexWrap: 'wrap', margin: '0 0 4px' }}>
              {posiciones.map((p) => (
                <span key={p.id} className="fila-form" style={{ gap: 2, margin: 0 }}>
                  <button type="button" className="btn-secundario" title="Aplicar esta posición y tamaño guardados" onClick={() => aplicarPreset(p)}>{p.nombre}</button>
                  <button type="button" className="btn-link" title="Eliminar este preset" onClick={() => eliminarPreset(p.id)}>✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="fila-form" style={{ margin: '0 0 6px' }}>
            <input
              placeholder="Nombre para guardar esta posición y tamaño"
              value={nombrePreset}
              onChange={(e) => setNombrePreset(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button type="button" className="btn-secundario" disabled={!nombrePreset.trim() || guardandoPreset} onClick={guardarPresetActual}>
              {guardandoPreset ? 'Guardando…' : 'Guardar como preset'}
            </button>
          </div>
          <p className="texto-tenue" style={{ margin: '0 0 10px' }}>
            "Ticker", "ESPN Ticker" y "Broadcast Bonus" son barras de ancho completo — posición/tamaño no aplica.
          </p>

          <p className="seccion-titulo">Información en el tablero</p>
          <Toggle etiqueta="Mostrar faltas" checked={config.mostrarFaltas} onChange={(v) => cambiarConfig('mostrarFaltas', v)} />
          {config.mostrarFaltas && (
            <label className="subgrupo">
              Cómo se muestran las faltas
              <select value={config.estiloFaltas || 'numero'} onChange={(e) => cambiarConfig('estiloFaltas', e.target.value)}>
                <option value="numero">Número (suma total)</option>
                <option value="puntos">Puntos (●●●)</option>
                <option value="lineas">Líneas (tarjas)</option>
              </select>
            </label>
          )}
          <Toggle etiqueta="Flecha de posesión" checked={config.mostrarPosesion} onChange={(v) => cambiarConfig('mostrarPosesion', v)} />

          <p className="seccion-titulo">Animación de puntos (+1 / +2 / +3)</p>
          <Toggle
            etiqueta="Animación al sumar puntos"
            checked={mostrar(config, 'mostrarAnimacionPuntos')}
            onChange={(v) => cambiarConfig('mostrarAnimacionPuntos', v)}
          />
          {mostrar(config, 'mostrarAnimacionPuntos') && (
            <div className="subgrupo">
              <label>
                Dónde aparece
                <select
                  value={config.animacionPuntosPosicion || 'costado'}
                  onChange={(e) => cambiarConfig('animacionPuntosPosicion', e.target.value)}
                >
                  <option value="costado">Al costado del marcador (local izquierda, visita derecha)</option>
                  <option value="arriba">Arriba del marcador</option>
                  <option value="centro">Centro de la pantalla</option>
                  <option value="libre">Posición libre (elegís el punto exacto)</option>
                </select>
              </label>
              {config.animacionPuntosPosicion === 'libre' && (
                <>
                  <label>
                    Posición horizontal ({Math.round(Number.isFinite(config.animacionPuntosX) ? config.animacionPuntosX : 50)}%)
                    <input
                      type="range" min={0} max={100} step={1}
                      value={Number.isFinite(config.animacionPuntosX) ? config.animacionPuntosX : 50}
                      onChange={(e) => cambiarConfig('animacionPuntosX', Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Posición vertical ({Math.round(Number.isFinite(config.animacionPuntosY) ? config.animacionPuntosY : 50)}%)
                    <input
                      type="range" min={0} max={100} step={1}
                      value={Number.isFinite(config.animacionPuntosY) ? config.animacionPuntosY : 50}
                      onChange={(e) => cambiarConfig('animacionPuntosY', Number(e.target.value))}
                    />
                  </label>
                  <p className="texto-tenue" style={{ margin: 0, fontSize: 12 }}>
                    Independiente de dónde esté el marcador — podés ponerla en cualquier zona de la pantalla.
                  </p>
                </>
              )}
              <label>
                Tamaño ({Number.isFinite(config.animacionPuntosTamano) ? config.animacionPuntosTamano : 100}%)
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={10}
                  value={Number.isFinite(config.animacionPuntosTamano) ? config.animacionPuntosTamano : 100}
                  onChange={(e) => cambiarConfig('animacionPuntosTamano', Number(e.target.value))}
                />
              </label>
              <label>
                Estilo de animación
                <select
                  value={config.animacionPuntosEstilo || 'clasica'}
                  onChange={(e) => cambiarConfig('animacionPuntosEstilo', e.target.value)}
                >
                  <option value="clasica">Clásica (aparece con un giro y flota hacia arriba)</option>
                  <option value="rebote">Rebote (entra con un pique elástico)</option>
                  <option value="deslizar">Deslizar (entra desde el costado del equipo)</option>
                  <option value="destello">Destello (pulsa brillo, tipo neón)</option>
                </select>
              </label>
              <Toggle
                etiqueta="Sumarle una manito (☝️ 1pt / ✌️ 2pts / 🤟 3pts)"
                checked={Boolean(config.animacionPuntosConMano)}
                onChange={(v) => cambiarConfig('animacionPuntosConMano', v)}
              />
              {config.animacionPuntosConMano && (
                <p className="texto-tenue" style={{ margin: 0, fontSize: 12 }}>
                  No existe un emoji "3 dedos" exacto — para el triple se usa 🤟, la aproximación más parecida.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ───────── NÓMINA ───────── */}
        <div className="grupo-personalizacion" hidden={seccionAbierta !== 'nomina'}>
          <div className="grupo-titulo">👥 Nómina</div>
          <Toggle etiqueta="Mostrar nómina" checked={config.mostrarNomina} onChange={(v) => cambiarConfig('mostrarNomina', v)} />
          {config.mostrarNomina && (
            <div className="subgrupo">
              <SelectorUbicacion etiqueta="Costado en pantalla" valor={config.nominaPosicion} onChange={(v) => cambiarConfig('nominaPosicion', v)} opciones={OPCIONES_UBICACION_NOMINA} />
              <p className="texto-tenue" style={{ margin: '-4px 0 0' }}>Siempre pegada arriba — acá solo se elige el costado.</p>
              <Toggle etiqueta="Logo del equipo" checked={config.logoEnNomina} onChange={(v) => cambiarConfig('logoEnNomina', v)} />
              {config.logoEnNomina && (
                <div className="subgrupo">
                  <label>
                    Dónde va el logo
                    <select value={config.nominaLogoPosicion || 'costado'} onChange={(e) => cambiarConfig('nominaLogoPosicion', e.target.value)}>
                      <option value="costado">Chico, junto al nombre del equipo</option>
                      <option value="fondo">Grande, de fondo detrás de toda la nómina</option>
                    </select>
                  </label>
                  {config.nominaLogoPosicion === 'fondo' ? (
                    <>
                      <label>
                        Tamaño ({config.nominaLogoFondoTamano || 130}% de la altura de la nómina)
                        <input
                          type="range"
                          min={100}
                          max={220}
                          value={Number.isFinite(config.nominaLogoFondoTamano) ? config.nominaLogoFondoTamano : 130}
                          onChange={(e) => cambiarConfig('nominaLogoFondoTamano', Number(e.target.value))}
                        />
                      </label>
                      <p className="texto-tenue" style={{ margin: 0 }}>Nunca queda más chico que la altura de la nómina.</p>
                    </>
                  ) : (
                    <label>Tamaño ({config.logoTamanoNomina}px)
                      <input type="range" min={20} max={140} value={config.logoTamanoNomina} onChange={(e) => cambiarConfig('logoTamanoNomina', Number(e.target.value))} />
                    </label>
                  )}
                  <label>Transparencia ({config.logoOpacidadNomina}%)
                    <input type="range" min={10} max={100} value={config.logoOpacidadNomina} onChange={(e) => cambiarConfig('logoOpacidadNomina', Number(e.target.value))} />
                  </label>
                </div>
              )}
              <Toggle etiqueta="Estadísticas por jugador" checked={config.nominaConEstadisticas} onChange={(v) => cambiarConfig('nominaConEstadisticas', v)} />
              <SelectorDuracion etiqueta="Segundos visible al dispararla" valor={config.nominaDuracionSeg} porDefecto={6} onChange={(v) => cambiarConfig('nominaDuracionSeg', v)} />
            </div>
          )}
        </div>

        {/* ───────── ESTADÍSTICAS ───────── */}
        <div className="grupo-personalizacion" hidden={seccionAbierta !== 'estadisticas'}>
          <div className="grupo-titulo">📊 Estadísticas</div>
          <Toggle etiqueta="Mostrar estadísticas" checked={config.mostrarEstadisticas} onChange={(v) => cambiarConfig('mostrarEstadisticas', v)} />
          {config.mostrarEstadisticas && (
            <div className="subgrupo">
              <SelectorUbicacion etiqueta="Ubicación en pantalla" valor={config.estadisticasPosicion} onChange={(v) => cambiarConfig('estadisticasPosicion', v)} />
              <p className="texto-tenue" style={{ margin: '-4px 0 0' }}>
                Aplica a "Ambos equipos" y a jugador — un solo equipo sale pegado a su propio lado.
              </p>
              <Toggle etiqueta="Escudos de los equipos" checked={config.logoEnEstadisticas} onChange={(v) => cambiarConfig('logoEnEstadisticas', v)} />
              {config.logoEnEstadisticas && (
                <div className="fila-form">
                  <label>Tamaño ({config.logoTamanoEstadisticas}px)
                    <input type="range" min={30} max={160} value={config.logoTamanoEstadisticas} onChange={(e) => cambiarConfig('logoTamanoEstadisticas', Number(e.target.value))} />
                  </label>
                  <label>Transparencia ({config.logoOpacidadEstadisticas}%)
                    <input type="range" min={10} max={100} value={config.logoOpacidadEstadisticas} onChange={(e) => cambiarConfig('logoOpacidadEstadisticas', Number(e.target.value))} />
                  </label>
                </div>
              )}
              <Toggle etiqueta="Detalle por jugador" checked={config.mostrarDetalleJugadores} onChange={(v) => cambiarConfig('mostrarDetalleJugadores', v)} />
              <SelectorDuracion etiqueta="Segundos visible al dispararlas" valor={config.estadisticasDuracionSeg} porDefecto={7} onChange={(v) => cambiarConfig('estadisticasDuracionSeg', v)} />
            </div>
          )}
        </div>

        {/* ───────── ANUNCIOS ───────── */}
        <div className="grupo-personalizacion" hidden={seccionAbierta !== 'anuncios'}>
          <div className="grupo-titulo">📣 Anuncios de jugadas</div>
          <Toggle etiqueta="Anunciar jugadas" checked={config.anunciarJugadas} onChange={(v) => cambiarConfig('anunciarJugadas', v)} />
          {config.anunciarJugadas && (
            <div className="subgrupo">
              <label>
                Dónde aparece el aviso
                <select value={config.alertaPosicion || ''} onChange={(e) => cambiarConfig('alertaPosicion', e.target.value)}>
                  <option value="">Automático según el diseño</option>
                  <option value="costado">Como pestaña al costado (izquierda si es local, derecha si es visita)</option>
                  <option value="arriba">Como pestaña arriba del marcador</option>
                  <option value="superpone">Superpuesto, justo sobre el marcador</option>
                </select>
              </label>
              {config.mostrarTitulo && (config.alertaPosicion || '') !== 'costado' && (config.alertaPosicion || '') !== 'superpone' && (
                <label>
                  Cómo convive con el título
                  <select value={config.anunciosTituloModo || 'arriba-titulo'} onChange={(e) => cambiarConfig('anunciosTituloModo', e.target.value)}>
                    <option value="arriba-titulo">Apilado arriba del título (más chico, sin taparlo)</option>
                    <option value="reemplaza-titulo">Reemplaza el título mientras dura el aviso</option>
                    <option value="debajo-marcador">Debajo del marcador, en vez de arriba</option>
                  </select>
                </label>
              )}
              <label>
                Animación del aviso
                <select value={config.alertaAnimacion || ''} onChange={(e) => cambiarConfig('alertaAnimacion', e.target.value)}>
                  {OPCIONES_ANIMACION_ANUNCIO.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
                </select>
              </label>
              <Toggle etiqueta="Anunciar faltas" checked={config.anunciarFaltas} onChange={(v) => cambiarConfig('anunciarFaltas', v)} />
              <SelectorDuracion etiqueta="Segundos visible cada aviso" valor={config.anunciosDuracionSeg} porDefecto={4} onChange={(v) => cambiarConfig('anunciosDuracionSeg', v)} />
            </div>
          )}
        </div>

        {/* ───────── LOGOS LIBRES ───────── */}
        <div className="grupo-personalizacion" hidden={seccionAbierta !== 'logos'}>
          <div className="grupo-titulo">🖼️ Logos libres (competencia, torneo, liga…)</div>
          <p className="texto-tenue" style={{ margin: '0 0 10px' }}>
            Subí el logo y agregalo a la pantalla — después arrastralo directo en la vista previa de arriba para ubicarlo donde quieras.
            El tamaño y la transparencia se ajustan acá abajo, por cada logo.
          </p>
          <SelectorLogo logos={logos} value="" onChange={agregarLogoLibre} onLogoSubido={(l) => { setLogos((prev) => [l, ...prev]); agregarLogoLibre(urlLogo(l.filename)); }} />

          {logosLibres.length === 0 ? (
            <p className="texto-tenue" style={{ marginTop: 10 }}>Todavía no agregaste ningún logo libre.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {logosLibres.map((logo) => (
                <div key={logo.id} className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="fila-form" style={{ margin: 0, justifyContent: 'space-between' }}>
                    <div className="fila-form" style={{ margin: 0 }}>
                      <img src={logo.logoUrl} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                      <span className="texto-tenue">{logos.find((l) => urlLogo(l.filename) === logo.logoUrl)?.nombre || 'Logo'}</span>
                    </div>
                    <button type="button" className="btn-link" onClick={() => eliminarLogoLibre(logo.id)}>🗑️ Quitar</button>
                  </div>
                  <label>
                    Tamaño ({Math.round(logo.anchoPercent ?? 15)}%)
                    <input
                      type="range" min={3} max={40} step={1}
                      value={Number.isFinite(logo.anchoPercent) ? logo.anchoPercent : 15}
                      onChange={(e) => actualizarLogoLibre(logo.id, { anchoPercent: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Transparencia ({Math.round(logo.opacidad ?? 100)}%)
                    <input
                      type="range" min={10} max={100} step={1}
                      value={Number.isFinite(logo.opacidad) ? logo.opacidad : 100}
                      onChange={(e) => actualizarLogoLibre(logo.id, { opacidad: Number(e.target.value) })}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-secundario"
          style={{ alignSelf: 'flex-start' }}
          title="Vuelve todos los colores, tamaños y opciones a los valores por defecto de la plantilla — el enlace de OBS no cambia"
          onClick={restablecerPreferencias}
        >
          ↺ Restablecer todo a los valores originales (mismo enlace de OBS)
        </button>
        </div>
      </div>
    </div>
  );
}

export default function Disenos() {
  const { usuario } = useAuth();
  const [disenos, setDisenos] = useState([]);
  const [plantillasOcultas, setPlantillasOcultas] = useState([]);
  const [editando, setEditando] = useState(null); // null | { id?, nombre?, plantilla_base, config? }
  const [error, setError] = useState('');

  const cargar = () => {
    api.listarDisenos().then((d) => setDisenos(d.disenos));
    api.listarPlantillasOcultas().then((d) => setPlantillasOcultas(d.plantillas));
  };

  useEffect(() => { cargar(); }, []);

  // Solo el super admin puede sacar una plantilla ENTERA del catálogo (para
  // todo el mundo, no solo su cuenta) — a diferencia de `eliminar` (abajo),
  // que borra la personalización de un usuario puntual y la tarjeta sigue
  // apareciendo en blanco. Confirmación reforzada porque afecta a todos.
  const ocultarPlantilla = async (plantilla) => {
    if (!window.confirm(`¿Sacar "${plantilla.nombre}" del catálogo para TODOS los usuarios? Se puede restaurar después desde el panel de administración.`)) return;
    try {
      await api.adminOcultarPlantilla(plantilla.id);
      setPlantillasOcultas((p) => [...p, plantilla.id]);
    } catch (err) {
      setError(err.message);
    }
  };

  // Guardar ya no cierra la pantalla ni navega a ningún lado — el usuario
  // sigue en "Personalizar tablero"/"Juego en vivo" hasta que aprieta
  // "Volver al catálogo" a propósito. Devuelve el diseño (con su id) para
  // que "Crear partido y empezar" lo pueda usar apenas se guarda.
  const guardar = async (payload) => {
    if (editando?.id) {
      const { diseno } = await api.actualizarDiseno(editando.id, payload);
      cargar();
      return diseno;
    }
    const { diseno } = await api.crearDiseno(payload);
    setEditando(diseno);
    cargar();
    return diseno;
  };

  // "Usar este diseño" en el catálogo de plantillas es ambiguo: si el
  // usuario ya venía trabajando con esa plantilla, volver a tocarla NO debe
  // crear un diseño (y por lo tanto un partido/enlace) nuevo de cero — eso
  // es justo lo que hacía que el marcador y el enlace de OBS "se reseteen"
  // al volver al catálogo y re-entrar. Si ya existe un diseño guardado con
  // esa plantilla, se retoma ese (el más reciente); recién si no existe
  // ninguno se arranca uno en blanco.
  // OJO: acá NO alcanza con buscar en el `disenos` que ya está en memoria —
  // ese array se cargó una sola vez al entrar al catálogo y puede haber
  // quedado viejo (por ejemplo, si adentro de "Personalizar tablero" recién
  // ahí se creó el partido activo de este diseño, `disenos` en memoria
  // todavía no se enteró). Con un `partido_activo_id` viejo/vacío,
  // "Personalizar tablero → Equipos" no encuentra el equipo real que ya
  // está jugando, y cualquier cambio de nombre/color/logo termina creando
  // un equipo NUEVO en vez de actualizar el que está en cancha — quedaba
  // como que "no pasaba nada" en el tablero/OBS. Por eso se pide la lista
  // de nuevo, fresca, justo antes de abrir.
  const usarPlantilla = async (plantillaId) => {
    const { disenos: frescos } = await api.listarDisenos();
    setDisenos(frescos);
    const existente = frescos.find((d) => d.plantilla_base === plantillaId);
    setEditando(existente || { plantilla_base: plantillaId });
  };

  const eliminar = async (id) => {
    try {
      await api.eliminarDiseno(id);
      setEditando(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="pagina">
      <h1>Diseños de marcador</h1>
      <p className="texto-tenue">
        Elegí un estilo de tablero. Queda guardado en tu cuenta automáticamente: la próxima vez que lo abrís seguís
        exactamente donde lo dejaste (marcador, equipos, todo), con el mismo enlace fijo para OBS.
      </p>
      {error && <p className="mensaje-error">{error}</p>}

      {editando ? (
        <FormularioDiseno
          inicial={editando}
          onGuardar={guardar}
          onEliminar={eliminar}
          onCancelar={() => setEditando(null)}
        />
      ) : (
        <div className="grilla-tarjetas">
          {PLANTILLAS_MARCADOR.filter((p) => !plantillasOcultas.includes(p.id)).map((p) => {
            const guardado = disenos.find((d) => d.plantilla_base === p.id);
            return (
              <div className="tarjeta" key={p.id}>
                <MiniPreviewMarcador plantillaId={p.id} config={guardado?.config || {}} />
                <strong>{p.nombre}</strong>
                <div className="tarjeta-acciones">
                  <button className="btn-primario" onClick={() => usarPlantilla(p.id)}>Usar este diseño</button>
                  {guardado && (
                    <button
                      type="button"
                      className="btn-link"
                      title="Elimina definitivamente este diseño guardado — si solo querés cambiarle algo, entrá con 'Usar este diseño'"
                      onClick={() => {
                        if (window.confirm(mensajeConfirmarEliminar(guardado))) eliminar(guardado.id);
                      }}
                    >
                      🗑️ Eliminar definitivamente
                    </button>
                  )}
                </div>
                {usuario?.es_admin && (
                  <button
                    type="button"
                    className="btn-link"
                    style={{ fontSize: 11, marginTop: 2 }}
                    title="Sacar esta plantilla del catálogo para todos los usuarios"
                    onClick={() => ocultarPlantilla(p)}
                  >
                    Quitar plantilla del catálogo (admin)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
