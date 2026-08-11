import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createWorker, PSM } from 'tesseract.js';
import { api, getToken } from '../api/client';
import { crearSocket } from '../socket';
import './lectorReloj.css';

// Acepta "10:00", "1000" (sin separador, algunos relojes de cancha no lo
// muestran), "10.00" o "10;00" (el OCR a veces confunde ":" con otro
// símbolo parecido) — siempre 1-2 dígitos de minuto + 2 de segundo.
function parsearTiempo(textoCrudo) {
  const limpio = (textoCrudo || '').replace(/\s+/g, '').replace(/O/gi, '0');
  let m = limpio.match(/^(\d{1,2})[:;.,](\d{2})$/);
  if (!m) m = limpio.match(/^(\d{1,2})(\d{2})$/);
  if (!m) return null;
  const minutos = Number(m[1]);
  const segundos = Number(m[2]);
  if (segundos > 59 || minutos > 99) return null;
  return minutos * 60 + segundos;
}

const formatearReloj = (totalSegundos = 0) => {
  const seguro = Math.max(0, Number(totalSegundos) || 0);
  const minutos = Math.floor(seguro / 60);
  const segundos = seguro % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
};

// Recorte central de la guía en pantalla (ver .lr-guia en el CSS) — el
// operador encuadra los dígitos del reloj físico ahí adentro; acá se
// recorta ESE mismo rectángulo del video real para no leer nada del resto
// de la imagen (tribuna, cancha, etc.), que solo confundiría al OCR.
const GUIA_ANCHO = 0.62;
const GUIA_ALTO = 0.26;

// Ventana de lecturas recientes (crudas, una por ciclo de cámara, ~1.2s
// entre cada una) usada para adivinar si el reloj FÍSICO está corriendo o
// pausado — no alcanza con comparar solo las últimas dos (un cuenta-regresivo
// real puede quedar "plano" por un instante si la lectura cae justo entre
// dos segundos). 'corriendo': la ventana bajó en conjunto (más nueva < más
// vieja). 'pausado': las últimas 3 salieron EXACTAMENTE iguales — pedir las
// 3 iguales (no solo 2) evita que un solo cuadro repetido por casualidad
// dispare una pausa falsa. Cualquier otra combinación (ruido, un salto raro
// del OCR) se deja como estaba antes en vez de arriesgar una decisión.
const VENTANA_TENDENCIA = 4;
function detectarTendencia(ventana, tendenciaPrevia) {
  if (ventana.length < 3) return 'desconocida';
  const ultimasTres = ventana.slice(-3);
  if (ultimasTres.every((v) => v === ultimasTres[0])) return 'pausado';
  if (ventana[ventana.length - 1] < ventana[0]) return 'corriendo';
  return tendenciaPrevia;
}

export default function LectorReloj() {
  const { id } = useParams();
  const [partido, setPartido] = useState(null);
  const [error, setError] = useState('');
  const [estadoCamara, setEstadoCamara] = useState('apagada'); // apagada | iniciando | activa
  const [ultimaLectura, setUltimaLectura] = useState(null); // { texto, totalSegundos, ts }
  const [estable, setEstable] = useState(false);
  const [autoAplicar, setAutoAplicar] = useState(false);
  const [ultimoAplicado, setUltimoAplicado] = useState(null);
  const [relojActual, setRelojActual] = useState(null);
  const [relojCorriendo, setRelojCorriendo] = useState(false);
  // 'desconocida' | 'corriendo' | 'pausado' — lo que el lector CREE que está
  // haciendo el reloj físico ahora mismo, mirado en la ventana de lecturas
  // recientes (ver detectarTendencia). Se muestra en pantalla y, con
  // "Aplicar automático" prendido, también dispara RELOJ_INICIAR/PAUSAR.
  const [tendencia, setTendencia] = useState('desconocida');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const workerRef = useRef(null);
  const streamRef = useRef(null);
  const activoRef = useRef(false);
  const lecturasRecientesRef = useRef([]);
  // `loopLectura` arranca UNA vez (al prender la cámara) y sigue llamando a
  // la MISMA `capturarYLeer` mientras la cámara esté activa — leer
  // `autoAplicar`/`ultimoAplicado`/`relojCorriendo` directo del estado ahí
  // adentro los dejaba "congelados" en el valor que tenían en ese momento
  // (tocar el toggle DESPUÉS de prender la cámara no tenía efecto hasta
  // apagarla y prenderla de nuevo). Estas refs se mantienen al día con cada
  // useEffect de abajo, así el loop siempre lee el valor real vigente.
  const autoAplicarRef = useRef(autoAplicar);
  const ultimoAplicadoRef = useRef(ultimoAplicado);
  const relojCorriendoRef = useRef(relojCorriendo);
  useEffect(() => { autoAplicarRef.current = autoAplicar; }, [autoAplicar]);
  useEffect(() => { ultimoAplicadoRef.current = ultimoAplicado; }, [ultimoAplicado]);
  useEffect(() => { relojCorriendoRef.current = relojCorriendo; }, [relojCorriendo]);

  // Con `id` en la URL (enlace viejo, por partido) se pide ESE partido
  // puntual — sin `id` (enlace nuevo, fijo por usuario, ver /mesa/reloj-camara
  // en App.jsx) se resuelve solo al partido "en_curso" más reciente de la
  // cuenta, así el mismo enlace sirve para cualquier marcador que el usuario
  // tenga abierto en ese momento, sin tener que copiar uno nuevo cada vez.
  useEffect(() => {
    let activo = true;
    const pedido = id ? api.obtenerPartido(id) : api.obtenerPartidoActivo();
    pedido.then((d) => { if (activo) setPartido(d.partido); }).catch((err) => activo && setError(err.message));
    const socket = crearSocket();
    socketRef.current = socket;
    socket.on('estado', (e) => { setRelojActual(e.relojSegundos); setRelojCorriendo(e.relojCorriendo); });
    return () => { activo = false; socket.disconnect(); };
  }, [id]);

  useEffect(() => {
    if (!partido) return;
    setRelojActual(partido.relojSegundos);
    setRelojCorriendo(partido.relojCorriendo);
    socketRef.current?.emit('unirse_mesa', { publicToken: partido.publicToken });
  }, [partido]);

  useEffect(() => () => {
    activoRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    workerRef.current?.terminate();
  }, []);

  const emitirAccion = (tipo, payload = {}) => {
    if (!socketRef.current || !partido) return;
    socketRef.current.emit('accion', { publicToken: partido.publicToken, tipo, token: getToken(), payload });
  };

  const capturarYLeer = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !workerRef.current) return;

    const sx = video.videoWidth * (1 - GUIA_ANCHO) / 2;
    const sy = video.videoHeight * (1 - GUIA_ALTO) / 2;
    const sw = video.videoWidth * GUIA_ANCHO;
    const sh = video.videoHeight * GUIA_ALTO;
    const escala = 3; // agranda el recorte antes de pasarlo al OCR — mejora mucho la lectura de dígitos chicos
    canvas.width = sw * escala;
    canvas.height = sh * escala;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    // Escala de grises + estiramiento de contraste ADAPTATIVO (no blanco/
    // negro puro, no un multiplicador fijo) — antes se estiraba siempre
    // alrededor de un gris medio fijo (128) con un factor fijo (1.7), lo
    // que asume una iluminación "típica"; un gimnasio muy oscuro o un
    // reloj muy iluminado de cerca quedaban mal calibrados sin ningún
    // ajuste posible. Acá se mide el brillo REAL de ESTE cuadro puntual
    // (percentiles 2%/98%, no el mínimo/máximo exacto — así un solo
    // reflejo de luz quemado o un rincón muy oscuro no corren todo el
    // rango) y se estira ESE rango a blanco/negro — funciona parejo sea
    // cual sea la luz del lugar, sin depender de una constante que solo
    // sirve para un caso. Sigue sin ser un umbral binario duro: conserva
    // el degradé del borde de cada dígito, la pista que más ayuda al
    // motor LSTM de Tesseract a distinguir dígitos parecidos ("0" de "9").
    const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const totalPixeles = datos.data.length / 4;
    const grises = new Uint8ClampedArray(totalPixeles);
    const histograma = new Uint32Array(256);
    for (let i = 0, p = 0; i < datos.data.length; i += 4, p++) {
      const gris = Math.round(0.299 * datos.data[i] + 0.587 * datos.data[i + 1] + 0.114 * datos.data[i + 2]);
      grises[p] = gris;
      histograma[gris]++;
    }
    let negro = 0;
    let blanco = 255;
    let acumulado = 0;
    for (let v = 0; v < 256; v++) {
      acumulado += histograma[v];
      if (acumulado >= totalPixeles * 0.02) { negro = v; break; }
    }
    acumulado = 0;
    for (let v = 255; v >= 0; v--) {
      acumulado += histograma[v];
      if (acumulado >= totalPixeles * 0.02) { blanco = v; break; }
    }
    const rango = Math.max(1, blanco - negro);
    for (let p = 0; p < totalPixeles; p++) {
      const valor = Math.max(0, Math.min(255, ((grises[p] - negro) / rango) * 255));
      const i = p * 4;
      datos.data[i] = datos.data[i + 1] = datos.data[i + 2] = valor;
    }
    ctx.putImageData(datos, 0, 0);

    try {
      const { data } = await workerRef.current.recognize(canvas);
      const texto = (data.text || '').trim();
      const totalSegundos = parsearTiempo(texto);
      setUltimaLectura({ texto, totalSegundos, ts: Date.now() });

      if (totalSegundos == null) {
        lecturasRecientesRef.current = [];
        setEstable(false);
        return;
      }

      lecturasRecientesRef.current = [...lecturasRecientesRef.current, totalSegundos].slice(-VENTANA_TENDENCIA);
      const ventana = lecturasRecientesRef.current;

      // Dos lecturas SEGUIDAS que coincidan (o difieran como mucho 1s, ya
      // que el reloj real pudo haber bajado justo entre una lectura y la
      // siguiente) antes de confiar en el valor — un solo frame raro no
      // alcanza para tocar el reloj oficial del partido.
      const [previa, actual] = ventana.slice(-2);
      const esEstable = ventana.length >= 2 && Math.abs(previa - actual) <= 1;
      setEstable(esEstable);

      // Corriendo/pausado: mira la ventana entera (más lecturas que el
      // chequeo de "estable" de arriba) para no confundirse con un instante
      // sin cambio de segundo. Ver detectarTendencia.
      const nuevaTendencia = detectarTendencia(ventana, tendencia);
      setTendencia(nuevaTendencia);

      const auto = autoAplicarRef.current;
      if (auto && esEstable && actual !== ultimoAplicadoRef.current) {
        emitirAccion('RELOJ_FIJAR', { segundos: actual });
        setUltimoAplicado(actual);
      }
      if (auto && nuevaTendencia === 'corriendo' && !relojCorriendoRef.current) {
        emitirAccion('RELOJ_INICIAR');
      } else if (auto && nuevaTendencia === 'pausado' && relojCorriendoRef.current) {
        emitirAccion('RELOJ_PAUSAR');
      }
    } catch {
      // Frame ilegible (fuera de foco, mano tapando, etc.) — se reintenta
      // solo en el próximo ciclo, sin cortar la cámara ni mostrar error.
    }
  };

  const loopLectura = async () => {
    while (activoRef.current) {
      await capturarYLeer();
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  };

  const iniciarCamara = async () => {
    setError('');
    setEstadoCamara('iniciando');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!workerRef.current) {
        const worker = await createWorker('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789:;.,', tessedit_pageseg_mode: PSM.SINGLE_LINE });
        workerRef.current = worker;
      }
      activoRef.current = true;
      setEstadoCamara('activa');
      loopLectura();
    } catch (err) {
      setError('No se pudo acceder a la cámara: ' + err.message);
      setEstadoCamara('apagada');
    }
  };

  const detenerCamara = () => {
    activoRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setEstadoCamara('apagada');
    setUltimaLectura(null);
    setEstable(false);
    lecturasRecientesRef.current = [];
  };

  const aplicarManual = () => {
    if (ultimaLectura?.totalSegundos == null) return;
    emitirAccion('RELOJ_FIJAR', { segundos: ultimaLectura.totalSegundos });
    setUltimoAplicado(ultimaLectura.totalSegundos);
  };

  if (error && !partido) return <div className="pagina"><p className="mensaje-error">{error}</p></div>;
  if (!partido) return <div className="pagina"><p className="texto-tenue">Cargando…</p></div>;

  return (
    <div className="pagina lr-pagina">
      <div className="lr-header">
        <h1>📷 Lector de reloj por cámara</h1>
        <Link className="btn-secundario" to={`/mesa/${partido.id}`}>← Volver a la Mesa</Link>
      </div>
      <p className="texto-tenue">
        {partido.equipoLocal.nombre} vs {partido.equipoVisita.nombre} — apuntá esta cámara al reloj físico de la
        cancha. Es experimental: revisá siempre que el valor leído sea el correcto antes de aplicarlo (o el editor
        manual de la Mesa sigue disponible en cualquier momento).
      </p>
      {error && <p className="mensaje-error">{error}</p>}

      <div className="lr-video-wrap">
        <video ref={videoRef} className="lr-video" playsInline muted />
        <div className="lr-guia" />
        {estadoCamara !== 'activa' && (
          <div className="lr-video-vacio">
            <p>La cámara está apagada</p>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="lr-controles">
        {estadoCamara === 'activa' ? (
          <button className="btn-secundario" onClick={detenerCamara}>⏹ Apagar cámara</button>
        ) : (
          <button className="btn-primario" disabled={estadoCamara === 'iniciando'} onClick={iniciarCamara}>
            {estadoCamara === 'iniciando' ? 'Pidiendo permiso…' : '▶ Prender cámara'}
          </button>
        )}
        <label className="toggle-switch">
          <span>Aplicar automático (valor, y arrancar/pausar solo)</span>
          <input type="checkbox" checked={autoAplicar} onChange={(e) => setAutoAplicar(e.target.checked)} />
        </label>
      </div>

      <div className="lr-lectura">
        <div className="lr-lectura-item">
          <span className="texto-tenue">Reloj del partido ahora</span>
          <strong className="lr-lectura-valor">{formatearReloj(relojActual)}</strong>
          <span className={`lr-chip-estado ${relojCorriendo ? 'corriendo' : 'pausado'}`}>
            {relojCorriendo ? '▶ corriendo' : '⏸ pausado'}
          </span>
        </div>
        <div className="lr-lectura-item">
          <span className="texto-tenue">Última lectura de la cámara</span>
          <strong className={`lr-lectura-valor ${estable ? 'lr-estable' : ''}`}>
            {ultimaLectura?.totalSegundos != null ? formatearReloj(ultimaLectura.totalSegundos) : '— sin leer —'}
          </strong>
          {estadoCamara === 'activa' && (
            <span className={`lr-chip-estado ${tendencia}`}>
              {tendencia === 'corriendo' ? '▶ el reloj físico corre' : tendencia === 'pausado' ? '⏸ el reloj físico está parado' : '… detectando'}
            </span>
          )}
          {ultimaLectura && <span className="texto-tenue lr-lectura-cruda">texto crudo: "{ultimaLectura.texto || '(vacío)'}"</span>}
        </div>
      </div>

      <button
        className="btn-primario"
        style={{ width: '100%' }}
        disabled={ultimaLectura?.totalSegundos == null}
        onClick={aplicarManual}
      >
        ✓ Aplicar esta lectura al reloj del partido
      </button>
    </div>
  );
}
