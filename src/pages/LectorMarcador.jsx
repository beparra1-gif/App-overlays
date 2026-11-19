import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createWorker, PSM } from 'tesseract.js';
import { api } from '../api/client';
import { crearSocket } from '../socket';
import {
  INTERRUPTOR_POR_ZONA, ZONAS_POR_DEFECTO, corregirLectura, zonasDesdePalabras, parsearEntero, parsearReloj, prepararRecorte, valorConfirmado,
  estadoRelojFisico, estimarRelojFisicoDetalle, rachaFinal,
} from '../lector/ocr';
import './lectorMarcador.css';

const CLAVE_ZONAS = 'app_overlays_lector_zonas_v1';
const CLAVE_MODO = 'app_overlays_lector_modo';
const CLAVE_REDONDEO = 'app_overlays_lector_redondeo';
const PAUSA_ENTRE_LECTURAS_MS = 120;
const LATIDO_MS = 3000;
const NO_REENVIAR_MS = 4000;

const leerLocal = (clave, porDefecto) => {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : porDefecto;
  } catch {
    return porDefecto;
  }
};
const guardarLocal = (clave, valor) => {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin storage: solo esta sesión */ }
};

const fmtReloj = (s) => (s == null ? '—' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
const fmtValor = (zona, v) => (v == null ? '—' : zona.tipo === 'reloj' ? fmtReloj(v) : String(v));

// Reloj del partido AHORA (exacto, con fracción), con el mismo cálculo que
// usan OBS y la Mesa — base + referencia, corregido por la diferencia de
// hora con el servidor.
let desfaseServidor = 0;
function relojPartidoAhora(p) {
  if (!p) return 0;
  const base = Number.isFinite(p.relojSegundosBase) ? p.relojSegundosBase : p.relojSegundos;
  if (!p.relojCorriendo || !p.relojReferenciaEn) return Number(base) || 0;
  return Math.max(0, base - (Date.now() + desfaseServidor - new Date(p.relojReferenciaEn).getTime()) / 1000);
}

function posesionPartidoAhora(p) {
  const base = Number.isFinite(p.posesionSegundosBase) ? p.posesionSegundosBase : (p.posesionSegundos ?? 24);
  if (!p.posesionCorriendo || !p.posesionReferenciaEn) return Number(base) || 0;
  return Math.max(0, base - (Date.now() + desfaseServidor - new Date(p.posesionReferenciaEn).getTime()) / 1000);
}

// Cuánto puede alejarse una lectura de lo que ya marca el partido antes de
// sospechar un dígito mal leído (un doble/triple, un cambio de cuarto, una falta).
const CERCA_POR_ZONA = { ptsLocal: 6, ptsVisita: 6, periodo: 1, faltasLocal: 2, faltasVisita: 2 };

function valorActualDelPartido(partido, zonaId) {
  if (!partido) return null;
  return {
    reloj: Math.floor(relojPartidoAhora(partido)),
    ptsLocal: partido.ptsLocal,
    ptsVisita: partido.ptsVisita,
    periodo: partido.periodo,
    faltasLocal: partido.faltasPeriodoLocal,
    faltasVisita: partido.faltasPeriodoVisita,
    posesion: Math.floor(posesionPartidoAhora(partido)),
  }[zonaId];
}

function accionParaZona(zonaId, valor) {
  switch (zonaId) {
    case 'reloj': return ['RELOJ_FIJAR', { segundos: valor }];
    case 'ptsLocal': return ['PUNTOS_CORREGIR', { equipo: 'local', puntos: valor }];
    case 'ptsVisita': return ['PUNTOS_CORREGIR', { equipo: 'visita', puntos: valor }];
    case 'periodo': return ['PERIODO_FIJAR', { periodo: valor }];
    case 'faltasLocal': return ['FALTAS_EQUIPO_CORREGIR', { equipo: 'local', faltas: valor }];
    case 'faltasVisita': return ['FALTAS_EQUIPO_CORREGIR', { equipo: 'visita', faltas: valor }];
    case 'posesion': return ['POSESION_FIJAR', { segundos: valor }];
    default: return [null, null];
  }
}

// Lector de marcador por cámara: un celular (en la tribuna, sin iniciar
// sesión — entra con el enlace/QR de la Mesa) apunta al marcador físico del
// estadio; se encuadra cada dato (reloj, puntos, cuarto, faltas) con un
// recuadro y el OCR lo va leyendo. En "Automático" los valores confirmados
// se mandan solos al partido; en "Confirmar" hay que tocar "Aplicar".
export default function LectorMarcador() {
  const { token } = useParams();
  const [partido, setPartido] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [zonas, setZonas] = useState(() => {
    const guardadas = leerLocal(CLAVE_ZONAS, null);
    if (!Array.isArray(guardadas)) return ZONAS_POR_DEFECTO;
    return ZONAS_POR_DEFECTO.map((z) => ({ ...z, ...(guardadas.find((g) => g.id === z.id) || {}) }));
  });
  const [modo, setModo] = useState(() => leerLocal(CLAVE_MODO, 'auto'));
  // 'auto': cada zona prueba con y sin unir segmentos y se queda con lo que
  // mejor lee (el engrosado ayuda a los LED de 7 segmentos pero confunde
  // 9 con 8 en tipografías comunes). 'si'/'no': forzado a mano.
  const [unirSegmentos, setUnirSegmentos] = useState(() => leerLocal('app_overlays_lector_unir', 'auto'));
  const [calibracion, setCalibracion] = useState({});
  const [redondeaArriba, setRedondeaArriba] = useState(() => leerLocal(CLAVE_REDONDEO, false));
  const [editando, setEditando] = useState(true);
  const [camara, setCamara] = useState('apagada'); // apagada | iniciando | activa
  const [cargandoOcr, setCargandoOcr] = useState(false);
  const [lecturas, setLecturas] = useState({}); // zonaId → { texto, valor, confirmado }
  const [tendencia, setTendencia] = useState('desconocida');
  const [zoom, setZoom] = useState(null); // { min, max, step, valor } si la cámara lo permite
  const [aspecto, setAspecto] = useState(16 / 9);

  const videoRef = useRef(null);
  const marcoRef = useRef(null);
  const canvasRefs = useRef({});
  const socketRef = useRef(null);
  const workerRef = useRef(null);
  const streamRef = useRef(null);
  const wakeLockRef = useRef(null);
  const activoRef = useRef(false);
  const historialRef = useRef({});
  const enviadoRef = useRef({});
  const turnoRef = useRef(0);
  const tendenciaRef = useRef('desconocida');
  const muestrasRelojRef = useRef([]); // [{ v, t }] lecturas válidas con la hora EXACTA del cuadro
  const vueltaRef = useRef(0);
  const instantaneaRef = useRef(null);
  // La detección usa el mismo OCR: la lectura de zonas se pausa mientras tanto.
  const pausaRef = useRef(false);
  const vueltaEnCursoRef = useRef(null);
  const [detectando, setDetectando] = useState(false);
  const correccionRef = useRef(null);
  const calibracionRef = useRef({}); // zonaId → { si: {n, puntos}, no: {n, puntos}, elegido }
  // El loop de lectura arranca una vez: lee siempre la versión vigente de
  // todo esto por refs (si no, quedaría "congelado" en el primer render).
  const vivo = useRef({});
  vivo.current = { partido, zonas, modo, unirSegmentos, lecturas, redondeaArriba };

  useEffect(() => { guardarLocal(CLAVE_ZONAS, zonas); }, [zonas]);
  useEffect(() => { guardarLocal(CLAVE_MODO, modo); }, [modo]);
  useEffect(() => { guardarLocal(CLAVE_REDONDEO, redondeaArriba); }, [redondeaArriba]);
  useEffect(() => { guardarLocal('app_overlays_lector_unir', unirSegmentos); calibracionRef.current = {}; setCalibracion({}); }, [unirSegmentos]);

  useEffect(() => {
    let activo = true;
    api.obtenerLector(token)
      .then((d) => activo && setPartido(d.partido))
      .catch((err) => activo && setError(err.message));
    const socket = crearSocket();
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('unirse_lector', { lectorToken: token }));
    socket.on('estado', (e) => {
      if (!activo) return;
      if (Number.isFinite(e.servidorAhora)) {
        const m = e.servidorAhora - Date.now();
        if (m > desfaseServidor || Math.abs(m - desfaseServidor) > 5000) desfaseServidor = m;
      }
      setPartido(e);
    });
    socket.on('error_marcador', ({ error: msg }) => activo && setAviso(msg));
    const latido = setInterval(() => {
      const { lecturas: l, modo: m } = vivo.current;
      const resumen = Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v.confirmado ?? v.valor ?? null]));
      socket.emit('lector_latido', { lecturas: resumen, modo: m });
    }, LATIDO_MS);
    return () => {
      activo = false;
      clearInterval(latido);
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => () => {
    activoRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    workerRef.current?.terminate();
    wakeLockRef.current?.release?.().catch(() => {});
  }, []);

  const emitir = (tipo, payload) => {
    socketRef.current?.emit('accion', { publicToken: vivo.current.partido?.publicToken, tipo, token, payload });
  };

  const sincronizacion = partido?.sincronizacionCamara || {};
  const zonaHabilitada = (zonaId) => Boolean(sincronizacion.activo && sincronizacion[INTERRUPTOR_POR_ZONA[zonaId]]);

  const aplicar = (zonaId, valor, { forzar = false } = {}) => {
    if (valor == null) return;
    const ahora = Date.now();
    const previo = enviadoRef.current[zonaId];
    if (!forzar && previo && previo.valor === valor && ahora - previo.ts < NO_REENVIAR_MS) return;
    const [tipo, payload] = accionParaZona(zonaId, valor);
    if (!tipo) return;
    enviadoRef.current[zonaId] = { valor, ts: ahora };
    emitir(tipo, payload);
  };

  const leerZona = async (zona) => {
    const video = videoRef.current;
    // Un solo cuadro por lectura, con SU hora: todos los reintentos del OCR
    // usan esta misma instantánea (antes cada reintento tomaba un cuadro
    // nuevo con la hora del anterior, y mezclaba los tiempos).
    const tCuadro = Date.now();
    const instantanea = instantaneaRef.current || (instantaneaRef.current = document.createElement('canvas'));
    instantanea.width = video.videoWidth;
    instantanea.height = video.videoHeight;
    instantanea.getContext('2d').drawImage(video, 0, 0);
    let canvas = canvasRefs.current[zona.id];
    if (!canvas) canvas = canvasRefs.current[zona.id] = document.createElement('canvas');
    const hist = historialRef.current[zona.id] || [];
    const previoValido = [...hist].reverse().find((v) => v != null) ?? null;
    // Corrige dígitos confundidos (09:12 leído 89:12): nada más largo que el
    // cuarto en curso, y entre variantes, la más cercana a lo esperado.
    const pLectura = vivo.current.partido;
    const esperado = pLectura ? valorActualDelPartido(pLectura, zona.id) : null;
    const maxSeg = ((pLectura?.periodo > 4 ? pLectura?.minutosProrroga || 5 : pLectura?.minutosPeriodo || 10)) * 60;
    const interpretar = (t) => (zona.tipo === 'reloj'
      ? corregirLectura(t, (x) => parsearReloj(x, previoValido), { posible: (v) => v <= maxSeg, referencia: previoValido ?? esperado, cerca: 75 })
      : corregirLectura(t, (x) => parsearEntero(x, zona.max), { referencia: esperado, cerca: CERCA_POR_ZONA[zona.id] ?? Infinity }));
    // Tesseract a veces devuelve vacío con un solo dígito grueso en modo
    // "una línea": si no se entiende, se reintenta como "palabra" y, al
    // final, sin engrosar los segmentos. Solo cuesta más cuando falla.
    const modoUnir = vivo.current.unirSegmentos;
    const cal = calibracionRef.current[zona.id] || (calibracionRef.current[zona.id] = { si: { n: 0, puntos: 0 }, no: { n: 0, puntos: 0 }, elegido: null });
    let unirPrimero;
    if (modoUnir === 'si' || modoUnir === true) unirPrimero = true;
    else if (modoUnir === 'no' || modoUnir === false) unirPrimero = false;
    else if (cal.elegido) unirPrimero = cal.elegido === 'si';
    else unirPrimero = cal.si.n <= cal.no.n; // calibrando: alterna
    const intentos = [
      { psm: PSM.SINGLE_LINE, unir: unirPrimero, calibra: true },
      { psm: PSM.SINGLE_WORD, unir: unirPrimero },
      { psm: PSM.SINGLE_WORD, unir: !unirPrimero },
    ];
    let texto = '';
    let valor = null;
    let vistaCanvasHecha = false;
    for (const intento of intentos) {
      if (!vistaCanvasHecha || intento.unir !== intentos[0].unir) {
        prepararRecorte(instantanea, zona, canvas, { unirSegmentos: intento.unir });
        vistaCanvasHecha = true;
      }
      await workerRef.current.setParameters({
        tessedit_char_whitelist: zona.tipo === 'reloj' ? '0123456789:.' : '0123456789',
        tessedit_pageseg_mode: intento.psm,
      });
      const { data } = await workerRef.current.recognize(canvas);
      texto = (data.text || '').trim();
      valor = interpretar(texto);
      if (intento.calibra && !cal.elegido && (modoUnir === 'auto' || modoUnir == null)) {
        // Puntaje: confianza del OCR si la lectura se entiende, 0 si no.
        const lado = intento.unir ? cal.si : cal.no;
        lado.n += 1;
        lado.puntos += valor != null ? Number(data.confidence) || 0 : 0;
        if (cal.si.n >= 4 && cal.no.n >= 4) {
          cal.elegido = cal.si.puntos / cal.si.n >= cal.no.puntos / cal.no.n ? 'si' : 'no';
          historialRef.current[zona.id] = [];
          if (zona.id === 'reloj') muestrasRelojRef.current = [];
          setCalibracion((c) => ({ ...c, [zona.id]: cal.elegido }));
        }
      }
      if (valor != null) break;
    }
    const nuevoHist = [...hist, valor].slice(-6);
    historialRef.current[zona.id] = nuevoHist;
    const { partido: p, modo: m } = vivo.current;
    const actual = valorActualDelPartido(p, zona.id);
    const confirmado = valorConfirmado(nuevoHist, zona.id, actual);
    // Miniatura de lo que REALMENTE ve el OCR (ya en blanco y negro) — la
    // mejor pista para encuadrar bien el recuadro.
    const vista = canvas.toDataURL('image/png');
    setLecturas((prev) => ({ ...prev, [zona.id]: { texto, valor, confirmado, vista } }));

    if (!p) return;
    const sinc = p.sincronizacionCamara || {};
    const habilitada = sinc.activo && sinc[INTERRUPTOR_POR_ZONA[zona.id]];

    if (zona.id === 'reloj') {
      // Lecturas de los últimos 5 s (por tiempo, no por cantidad: con la
      // cámara leyendo cada ~200 ms, 6 lecturas cubrían apenas 1 s y la
      // pausa nunca llegaba a confirmarse).
      if (valor != null) muestrasRelojRef.current = [...muestrasRelojRef.current, { v: valor, t: tCuadro }].filter((m) => tCuadro - m.t <= 5000).slice(-40);
      const muestras = muestrasRelojRef.current;
      const nuevaTendencia = estadoRelojFisico(muestras, tendenciaRef.current);
      tendenciaRef.current = nuevaTendencia;
      setTendencia(nuevaTendencia);
      if (m !== 'auto' || !habilitada || valor == null) return;
      const ahora = Date.now();
      const servidor = relojPartidoAhora(p);
      const ultimoCambio = enviadoRef.current.relojEstado;
      const puedeCambiar = !ultimoCambio || ahora - ultimoCambio.ts > 1500;
      if (nuevaTendencia === 'corriendo') {
        // Valor real estimado AHORA (descontando lo que tardó el OCR).
        const est = estimarRelojFisicoDetalle(muestras, ahora, { redondeaArriba: vivo.current.redondeaArriba });
        if (!p.relojCorriendo && puedeCambiar) {
          // Arranque: la estimación tiene que cuadrar con el valor en que
          // estaba parado (si no, fue una lectura mala: se espera otra).
          const referencia = est.meseta ?? servidor;
          if (!est.inconsistente && Math.abs(est.valor - referencia) <= 2) {
            enviadoRef.current.relojEstado = { ts: ahora };
            emitir('RELOJ_INICIAR', { segundos: est.valor });
          }
        } else if (p.relojCorriendo) {
          // Corrección: solo con una estimación precisa y que se repite en
          // dos lecturas seguidas (una lectura mala no mueve el reloj).
          const diferencia = est.valor - servidor;
          const firme = !est.inconsistente && est.ancho <= 0.6 && Math.abs(diferencia) >= 1.2;
          const previa = correccionRef.current;
          if (firme && previa && Math.sign(previa) === Math.sign(diferencia) && Math.abs(previa - diferencia) < 0.8 && puedeCambiar) {
            enviadoRef.current.relojEstado = { ts: ahora };
            emitir('RELOJ_FIJAR', { segundos: est.valor });
            correccionRef.current = null;
          } else {
            correccionRef.current = firme ? diferencia : null;
          }
        }
      } else if (nuevaTendencia === 'pausado') {
        // Parado: el valor de la racha final (no la última lectura suelta,
        // que puede ser justo la errónea) ES lo que muestra el estadio.
        const racha = rachaFinal(muestras);
        const parado = racha ? racha.v : valor;
        const duracion = racha ? racha.hasta - racha.desde : 0;
        if (p.relojCorriendo && puedeCambiar) {
          // Pausa: tiene que estar cerca del reloj del partido (±1 s); si la
          // racha sigue más de 3 s, se acepta igual (partido desfasado).
          if (Math.abs(parado - servidor) <= 1.5 || duracion >= 3000) {
            enviadoRef.current.relojEstado = { ts: ahora };
            emitir('RELOJ_PAUSAR', { segundos: parado });
          }
        } else if (!p.relojCorriendo && Math.abs(parado - servidor) >= 1 && duracion >= 2000 && puedeCambiar) {
          enviadoRef.current.relojEstado = { ts: ahora };
          emitir('RELOJ_FIJAR', { segundos: parado });
        }
      }
      return;
    }
    // Posesión: el servidor la hace correr solo; se corrige únicamente ante
    // un salto claro (reinicio a 24/14 o un desfase de 2 s o más).
    if (zona.id === 'posesion') {
      if (m === 'auto' && habilitada && confirmado != null && Math.abs(confirmado - actual) >= 2) aplicar('posesion', confirmado);
      return;
    }
    if (m === 'auto' && habilitada && confirmado != null && confirmado !== actual) aplicar(zona.id, confirmado);
  };

  const loop = async () => {
    while (activoRef.current) {
      const video = videoRef.current;
      const activas = vivo.current.zonas.filter((z) => z.activa);
      if (video?.videoWidth && workerRef.current && activas.length && !pausaRef.current) {
        // El reloj se lee en cada vuelta (cambia cada segundo); el resto de
        // las zonas se turnan, una por vuelta.
        const reloj = activas.find((z) => z.id === 'reloj');
        const resto = activas.filter((z) => z.id !== 'reloj');
        vueltaRef.current += 1;
        try {
          vueltaEnCursoRef.current = (async () => {
          if (reloj) await leerZona(reloj);
          // Con reloj, el resto de las zonas se lee una vuelta sí y otra no:
          // el reloj es lo que más cambia y lo que más importa leer seguido.
          if (resto.length && (!reloj || vueltaRef.current % 2 === 0)) {
            turnoRef.current = (turnoRef.current + 1) % resto.length;
            await leerZona(resto[turnoRef.current]);
          }
          })();
          await vueltaEnCursoRef.current;
        } catch {
          // Cuadro ilegible (movimiento, reflejo): se reintenta en la próxima vuelta.
        }
      }
      await new Promise((r) => setTimeout(r, PAUSA_ENTRE_LECTURAS_MS));
    }
  };

  const prenderCamara = async () => {
    setError('');
    setCamara('iniciando');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (video.videoWidth) setAspecto(video.videoWidth / video.videoHeight);
      const track = stream.getVideoTracks()[0];
      const cap = track.getCapabilities?.() || {};
      if (cap.zoom) setZoom({ min: cap.zoom.min, max: cap.zoom.max, step: cap.zoom.step || 0.1, valor: track.getSettings?.().zoom || cap.zoom.min });
      try { wakeLockRef.current = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
      if (!workerRef.current) {
        setCargandoOcr(true);
        workerRef.current = await createWorker('eng');
        setCargandoOcr(false);
      }
      activoRef.current = true;
      setCamara('activa');
      loop();
      // Primer intento automático apenas hay imagen (si no encuentra nada, no molesta).
      setTimeout(() => detectarTablero({ silencioso: true }), 1500);
    } catch (err) {
      setCargandoOcr(false);
      const inseguro = typeof window !== 'undefined' && !window.isSecureContext;
      setError(inseguro
        ? 'La cámara solo funciona en una página segura (https). Abrí el enlace publicado de la app, no una IP local.'
        : `No se pudo usar la cámara: ${err.message}`);
      setCamara('apagada');
    }
  };

  // Busca solo el reloj, los puntajes y el cuarto en el cuadro completo y
  // mueve los recuadros ahí. Lo que no encuentra queda donde estaba.
  const detectarTablero = async ({ silencioso = false } = {}) => {
    const video = videoRef.current;
    if (!video?.videoWidth || !workerRef.current || detectando) return;
    setDetectando(true);
    pausaRef.current = true;
    try {
      await vueltaEnCursoRef.current?.catch(() => {});
      const cuadro = document.createElement('canvas');
      cuadro.width = video.videoWidth;
      cuadro.height = video.videoHeight;
      cuadro.getContext('2d').drawImage(video, 0, 0);
      const p = vivo.current.partido;
      const maxSeg = ((p?.periodo > 4 ? p?.minutosProrroga || 5 : p?.minutosPeriodo || 10)) * 60;
      await workerRef.current.setParameters({ tessedit_char_whitelist: '0123456789:.', tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      let mejor = {};
      // Sin engrosar y engrosando apenas (LED de 7 segmentos): gana la que encuentra más.
      for (const radio of [null, 2]) {
        const lienzo = prepararRecorte(cuadro, { x: 0, y: 0, w: 1, h: 1 }, document.createElement('canvas'), { unirSegmentos: radio != null, radio });
        const { data } = await workerRef.current.recognize(lienzo, {}, { blocks: true });
        const escala = cuadro.width / lienzo.width;
        const palabras = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((pa) => pa.lines.flatMap((l) => l.words)))
          .map((w) => ({ text: w.text, bbox: { x0: w.bbox.x0 * escala, y0: w.bbox.y0 * escala, x1: w.bbox.x1 * escala, y1: w.bbox.y1 * escala } }));
        const hallado = zonasDesdePalabras(palabras, cuadro.width, cuadro.height, maxSeg);
        if (Object.keys(hallado).length > Object.keys(mejor).length) mejor = hallado;
        if (mejor.reloj && mejor.ptsLocal) break;
      }
      const ids = Object.keys(mejor);
      if (!ids.length) {
        if (!silencioso) setAviso('No reconocí el tablero en la imagen. Acercá el zoom o encuadrá los recuadros a mano.');
        return;
      }
      setZonas((zs) => zs.map((z) => (mejor[z.id] ? { ...z, ...mejor[z.id], activa: true } : z)));
      ids.forEach((id) => { historialRef.current[id] = []; });
      muestrasRelojRef.current = [];
      const nombres = { reloj: 'reloj', ptsLocal: 'puntos local', ptsVisita: 'puntos visita', periodo: 'cuarto' };
      setAviso(`Tablero detectado: ${ids.map((id) => nombres[id]).join(', ')}. Revisá los recuadros y ajustá si hace falta.`);
    } catch {
      if (!silencioso) setAviso('No se pudo analizar la imagen. Probá de nuevo o encuadrá a mano.');
    } finally {
      pausaRef.current = false;
      setDetectando(false);
    }
  };

  const apagarCamara = () => {
    activoRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeLockRef.current?.release?.().catch(() => {});
    setCamara('apagada');
    setLecturas({});
    historialRef.current = {};
    muestrasRelojRef.current = [];
    tendenciaRef.current = 'desconocida';
    setTendencia('desconocida');
  };

  const cambiarZoom = (valor) => {
    const track = streamRef.current?.getVideoTracks()[0];
    track?.applyConstraints({ advanced: [{ zoom: valor }] }).catch(() => {});
    setZoom((z) => ({ ...z, valor }));
  };

  const actualizarZona = (id, cambios) => setZonas((zs) => zs.map((z) => (z.id === id ? { ...z, ...cambios } : z)));

  // Arrastrar (mover) o estirar (esquina) un recuadro sobre el video.
  const empezarArrastre = (e, zona, tipo) => {
    if (!editando) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = marcoRef.current.getBoundingClientRect();
    const inicio = { x: e.clientX, y: e.clientY, zona: { ...zona } };
    const mover = (ev) => {
      const dx = (ev.clientX - inicio.x) / rect.width;
      const dy = (ev.clientY - inicio.y) / rect.height;
      const z = inicio.zona;
      if (tipo === 'mover') {
        actualizarZona(zona.id, { x: Math.min(1 - z.w, Math.max(0, z.x + dx)), y: Math.min(1 - z.h, Math.max(0, z.y + dy)) });
      } else {
        actualizarZona(zona.id, { w: Math.min(1 - z.x, Math.max(0.04, z.w + dx)), h: Math.min(1 - z.y, Math.max(0.04, z.h + dy)) });
      }
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      historialRef.current[zona.id] = [];
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };

  if (error && !partido) {
    return <div className="lm-pagina"><div className="lm-tarjeta"><h1>📷 Lector de marcador</h1><p className="mensaje-error">{error}</p></div></div>;
  }
  if (!partido) return <div className="lm-pagina"><p className="texto-tenue">Conectando…</p></div>;

  const zonaReloj = zonas.find((z) => z.id === 'reloj');

  return (
    <div className="lm-pagina">
      <header className="lm-cabecera">
        <div>
          <h1>📷 Lector de marcador</h1>
          <p className="texto-tenue">{partido.equipoLocal.nombre} vs {partido.equipoVisita.nombre}</p>
        </div>
        <span className={`lm-chip ${sincronizacion.activo ? 'lm-chip-ok' : 'lm-chip-off'}`}>
          {sincronizacion.activo ? '● Marcador por cámara activo' : '○ La Mesa está en manual'}
        </span>
      </header>

      {!sincronizacion.activo && (
        <p className="lm-aviso">
          La Mesa tiene el marcador en <strong>manual</strong>: podés encuadrar y probar las lecturas, pero no se envían
          hasta que en la Mesa activen <strong>📷 Marcador por cámara</strong>.
        </p>
      )}
      {aviso && <p className="mensaje-error" role="alert">{aviso}</p>}
      {error && <p className="mensaje-error">{error}</p>}

      <div className="lm-video-marco" ref={marcoRef} style={{ aspectRatio: aspecto }}>
        <video ref={videoRef} className="lm-video" playsInline muted />
        {camara !== 'activa' && (
          <div className="lm-video-vacio">
            <p>Apuntá la cámara al marcador del estadio y encuadrá cada dato con su recuadro.</p>
          </div>
        )}
        {zonas.filter((z) => z.activa).map((z) => (
          <div
            key={z.id}
            className={`lm-zona ${editando ? 'lm-zona-editable' : ''}`}
            style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, '--lm-color': z.color }}
            onPointerDown={(e) => empezarArrastre(e, z, 'mover')}
          >
            <span className="lm-zona-etiqueta">{z.etiqueta}{lecturas[z.id]?.valor != null ? ` · ${fmtValor(z, lecturas[z.id].valor)}` : ''}</span>
            {editando && <span className="lm-zona-esquina" onPointerDown={(e) => empezarArrastre(e, z, 'estirar')} />}
          </div>
        ))}
      </div>

      <div className="lm-barra">
        {camara === 'activa' ? (
          <button className="btn-secundario" onClick={apagarCamara}>⏹ Apagar cámara</button>
        ) : (
          <button className="btn-primario" disabled={camara === 'iniciando'} onClick={prenderCamara}>
            {camara === 'iniciando' ? (cargandoOcr ? 'Preparando lector…' : 'Pidiendo permiso…') : '▶ Prender cámara'}
          </button>
        )}
        {camara === 'activa' && (
          <button className="btn-secundario" disabled={detectando} onClick={() => detectarTablero()}>
            {detectando ? 'Buscando el tablero…' : '🔍 Detectar tablero'}
          </button>
        )}
        <button className={`btn-secundario ${editando ? 'lm-activo' : ''}`} onClick={() => setEditando((v) => !v)}>
          {editando ? '🔓 Encuadrando (tocá para fijar)' : '🔒 Recuadros fijos'}
        </button>
        <div className="segmentado" role="group" aria-label="Modo de envío">
          <button className={modo === 'auto' ? 'activo' : ''} onClick={() => setModo('auto')}>Automático</button>
          <button className={modo === 'manual' ? 'activo' : ''} onClick={() => setModo('manual')}>Confirmar</button>
        </div>
      </div>

      {zoom && (
        <label className="lm-zoom">
          Zoom de la cámara
          <input type="range" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.valor} onChange={(e) => cambiarZoom(Number(e.target.value))} />
        </label>
      )}

      <div className="lm-lecturas">
        {zonas.map((z) => {
          const l = lecturas[z.id];
          const actual = valorActualDelPartido(partido, z.id);
          const habilitada = zonaHabilitada(z.id);
          const valor = l?.confirmado ?? l?.valor;
          return (
            <div key={z.id} className={`lm-lectura ${z.activa ? '' : 'lm-lectura-off'}`} style={{ '--lm-color': z.color }}>
              <label className="lm-lectura-cabeza">
                <input type="checkbox" checked={z.activa} onChange={(e) => actualizarZona(z.id, { activa: e.target.checked })} />
                <span>{z.etiqueta}</span>
                {!habilitada && <em title="En la Mesa este dato está en manual">manual</em>}
              </label>
              {z.activa && (
                <>
                  <div className="lm-lectura-valores">
                    <div>
                      <small>Cámara</small>
                      <strong className={l?.confirmado != null ? 'lm-confirmado' : ''}>{fmtValor(z, valor)}</strong>
                    </div>
                    <div>
                      <small>Partido</small>
                      <strong>{fmtValor(z, actual)}</strong>
                    </div>
                  </div>
                  {l?.vista && <img className="lm-vista" src={l.vista} alt={`Recorte leído de ${z.etiqueta}`} />}
                  <span className="lm-crudo">OCR: “{l?.texto || '…'}”</span>
                  {modo === 'manual' && (
                    <button
                      className="btn-secundario btn-chico"
                      disabled={!habilitada || valor == null || valor === actual}
                      onClick={() => aplicar(z.id, valor, { forzar: true })}
                    >
                      ✓ Aplicar
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {zonaReloj?.activa && camara === 'activa' && (
        <p className="texto-tenue lm-tendencia">
          Reloj físico: {tendencia === 'corriendo' ? '▶ corriendo' : tendencia === 'pausado' ? '⏸ detenido' : '… detectando'}
          {modo === 'auto' && zonaHabilitada('reloj') ? ' — se arranca/pausa solo' : ''}
        </p>
      )}

      <details className="lm-ayuda">
        <summary>Opciones y consejos</summary>
        <label>
          Engrosar trazos (une los segmentos de los LED)
          <select value={unirSegmentos === true ? 'si' : unirSegmentos === false ? 'no' : unirSegmentos} onChange={(e) => setUnirSegmentos(e.target.value)}>
            <option value="auto">Automático (prueba y elige por zona)</option>
            <option value="si">Siempre (tableros LED de 7 segmentos)</option>
            <option value="no">Nunca (pantallas con tipografía común)</option>
          </select>
        </label>
        {Object.keys(calibracion).length > 0 && (
          <p className="texto-tenue" style={{ margin: 0, fontSize: 12 }}>
            Calibrado: {Object.entries(calibracion).map(([z, v]) => `${ZONAS_POR_DEFECTO.find((x) => x.id === z)?.etiqueta || z} ${v === 'si' ? 'engrosado' : 'sin engrosar'}`).join(' · ')}
          </p>
        )}
        <label className="toggle-switch">
          <span>El reloj del estadio se queda el primer segundo entero (10:00 → 10:00 → 9:59)</span>
          <input type="checkbox" checked={redondeaArriba} onChange={(e) => setRedondeaArriba(e.target.checked)} />
        </label>
        <button className="btn-link" onClick={() => setZonas(ZONAS_POR_DEFECTO)}>↺ Volver los recuadros a su lugar inicial</button>
        <ul>
          <li>Usá un trípode o apoyá el celular: si la imagen se mueve, los recuadros dejan de coincidir.</li>
          <li>Cada recuadro tiene que tener SOLO los números (sin la palabra "HOME", flechas, etc.).</li>
          <li>Un valor se envía recién cuando sale igual varias lecturas seguidas; los cambios raros (un salto de muchos puntos, el cambio de cuarto) piden más confirmaciones.</li>
          <li>Si el celular se desconecta, la Mesa vuelve sola a sumar los puntos a mano.</li>
          <li>La pantalla se mantiene encendida mientras la cámara está prendida (si el navegador lo permite).</li>
        </ul>
      </details>
    </div>
  );
}
