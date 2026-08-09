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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const workerRef = useRef(null);
  const streamRef = useRef(null);
  const activoRef = useRef(false);
  const lecturasRecientesRef = useRef([]);

  useEffect(() => {
    let activo = true;
    api.obtenerPartido(id).then((d) => { if (activo) setPartido(d.partido); }).catch((err) => setError(err.message));
    const socket = crearSocket();
    socketRef.current = socket;
    socket.on('estado', (e) => setRelojActual(e.relojSegundos));
    return () => { activo = false; socket.disconnect(); };
  }, [id]);

  useEffect(() => {
    if (!partido) return;
    setRelojActual(partido.relojSegundos);
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

    // Escala de grises + contraste realzado (NO blanco/negro puro) — se
    // probó primero con un umbral duro (cualquier píxel > cierto brillo se
    // volvía blanco puro, el resto negro puro): reconocía el formato y la
    // posición del ":" bien, pero confundía dígitos parecidos ("0" leído
    // como "9") porque el corte binario se comía el degradé del borde
    // curvo del dígito, la pista visual que más los distingue. Estirar el
    // contraste alrededor del gris medio conserva ese degradé (el motor
    // LSTM de Tesseract, a diferencia de uno clásico por plantillas, lo
    // aprovecha) y de paso sigue limpiando reflejos/ruido de la cámara.
    const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const CONTRASTE = 1.7;
    for (let i = 0; i < datos.data.length; i += 4) {
      const gris = 0.299 * datos.data[i] + 0.587 * datos.data[i + 1] + 0.114 * datos.data[i + 2];
      const valor = Math.max(0, Math.min(255, (gris - 128) * CONTRASTE + 128));
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

      // Dos lecturas SEGUIDAS que coincidan (o difieran como mucho 1s, ya
      // que el reloj real pudo haber bajado justo entre una lectura y la
      // siguiente) antes de confiar en el valor — un solo frame raro no
      // alcanza para tocar el reloj oficial del partido.
      lecturasRecientesRef.current = [...lecturasRecientesRef.current, totalSegundos].slice(-2);
      const [previa, actual] = lecturasRecientesRef.current;
      const esEstable = lecturasRecientesRef.current.length === 2 && Math.abs(previa - actual) <= 1;
      setEstable(esEstable);

      if (esEstable && autoAplicar && actual !== ultimoAplicado) {
        emitirAccion('RELOJ_FIJAR', { segundos: actual });
        setUltimoAplicado(actual);
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
        <Link className="btn-secundario" to={`/mesa/${id}`}>← Volver a la Mesa</Link>
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
          <span>Aplicar automático (sin confirmar cada vez)</span>
          <input type="checkbox" checked={autoAplicar} onChange={(e) => setAutoAplicar(e.target.checked)} />
        </label>
      </div>

      <div className="lr-lectura">
        <div className="lr-lectura-item">
          <span className="texto-tenue">Reloj del partido ahora</span>
          <strong className="lr-lectura-valor">{formatearReloj(relojActual)}</strong>
        </div>
        <div className="lr-lectura-item">
          <span className="texto-tenue">Última lectura de la cámara</span>
          <strong className={`lr-lectura-valor ${estable ? 'lr-estable' : ''}`}>
            {ultimaLectura?.totalSegundos != null ? formatearReloj(ultimaLectura.totalSegundos) : '— sin leer —'}
          </strong>
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
