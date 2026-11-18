import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api/client';

const DATOS = [
  { id: 'reloj', etiqueta: 'Reloj de juego', ayuda: 'Fija el tiempo y arranca/pausa solo' },
  { id: 'puntos', etiqueta: 'Puntos', ayuda: 'El total de cada equipo sale del marcador del estadio' },
  { id: 'periodo', etiqueta: 'Cuarto', ayuda: 'Cambia de cuarto cuando el marcador cambia' },
  { id: 'faltas', etiqueta: 'Faltas de equipo', ayuda: 'Faltas del cuarto (las que dan bonus)' },
];

const mmss = (s) => (s == null ? '—' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
const val = (v) => (v == null ? '—' : v);
function lecturaDe(dato, l) {
  if (dato === 'reloj') return mmss(l.reloj);
  if (dato === 'puntos') return `${val(l.ptsLocal)} – ${val(l.ptsVisita)}`;
  if (dato === 'periodo') return val(l.periodo);
  return `${val(l.faltasLocal)} – ${val(l.faltasVisita)}`;
}

const hace = (ts) => {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 5 ? 'recién' : `hace ${s}s`;
};

// "Marcador por cámara": elegir si el marcador se lleva a mano (como siempre)
// o lo lee un celular apuntando al marcador del estadio, qué datos maneja la
// cámara, y el enlace/QR para conectar ese celular sin iniciar sesión.
export default function PanelMarcadorCamara({ partido, lector, onCambiar, onCerrar }) {
  const sinc = partido.sincronizacionCamara || {};
  const [enlace, setEnlace] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [, forzarRender] = useState(0);
  const esLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  useEffect(() => {
    let activo = true;
    api.crearEnlaceLector(partido.id)
      .then(async ({ token }) => {
        const url = `${window.location.origin}/lector/${token}`;
        const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 260, errorCorrectionLevel: 'M' });
        if (activo) { setEnlace(url); setQr(dataUrl); }
      })
      .catch((err) => activo && setError(err.message));
    const reloj = setInterval(() => forzarRender((n) => n + 1), 1000);
    return () => { activo = false; clearInterval(reloj); };
  }, [partido.id]);

  const cambiar = (cambios) => onCambiar({ activo: false, reloj: true, puntos: true, periodo: true, faltas: false, ...sinc, ...cambios });
  // Primera vez que se activa: reloj, puntos y cuarto prendidos por defecto.
  const activar = (activo) => cambiar(Object.keys(sinc).length ? { activo } : { activo, reloj: true, puntos: true, periodo: true, faltas: false });

  const copiar = () => {
    navigator.clipboard?.writeText(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const lecturas = lector?.lecturas || {};
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja pmc" onClick={(e) => e.stopPropagation()}>
        <div className="pmc-cabecera">
          <h3>📷 Marcador por cámara</h3>
          <span className={`pmc-estado ${lector?.conectado ? 'ok' : ''}`}>
            {lector?.conectado ? `● Cámara conectada (${lector.modo === 'auto' ? 'automático' : 'confirmando'}) · ${hace(lector.ultimoLatido)}` : '○ Ninguna cámara conectada'}
          </span>
        </div>

        <div className="segmentado pmc-modo" role="group" aria-label="Cómo se lleva el marcador">
          <button className={!sinc.activo ? 'activo' : ''} onClick={() => activar(false)}>✍️ Manual (Mesa)</button>
          <button className={sinc.activo ? 'activo' : ''} onClick={() => activar(true)}>📷 Por cámara</button>
        </div>
        <p className="texto-tenue pmc-explica">
          {sinc.activo
            ? 'Un celular apuntando al marcador del estadio lee los datos marcados abajo y los manda solo. Desde la Mesa seguís cargando jugadas para las estadísticas; si la cámara se desconecta, la Mesa vuelve a sumar a mano automáticamente.'
            : 'El marcador se lleva desde la Mesa, como siempre. Activá "Por cámara" para que un celular lea el marcador del estadio.'}
        </p>

        <div className={`pmc-datos ${sinc.activo ? '' : 'pmc-deshabilitado'}`}>
          {DATOS.map((d) => (
            <label key={d.id} className="pmc-dato">
              <input type="checkbox" disabled={!sinc.activo} checked={Boolean(sinc[d.id])} onChange={(e) => cambiar({ [d.id]: e.target.checked })} />
              <span>
                <strong>{d.etiqueta}</strong>
                <small>{d.ayuda}</small>
              </span>
              {lector?.conectado && <code title="Lo que está leyendo la cámara ahora">{lecturaDe(d.id, lecturas)}</code>}
            </label>
          ))}
        </div>

        <label className={`pmc-dato pmc-preguntar ${sinc.activo && sinc.puntos ? '' : 'pmc-deshabilitado'}`}>
          <input type="checkbox" disabled={!sinc.activo || !sinc.puntos} checked={Boolean(sinc.preguntar)} onChange={(e) => cambiar({ preguntar: e.target.checked })} />
          <span>
            <strong>Preguntar qué jugadora anotó</strong>
            <small>Cada vez que la cámara cambia los puntos, la Mesa muestra el quinteto en cancha para asignarlos. Si no elegís en 15 s, solo suma al marcador.</small>
          </span>
        </label>

        <div className="pmc-conectar">
          {qr ? <img src={qr} alt="Código QR del lector de marcador" className="pmc-qr" /> : <div className="pmc-qr pmc-qr-vacio">{error || 'Generando…'}</div>}
          <div className="pmc-conectar-texto">
            <strong>Conectar el celular</strong>
            <ol>
              <li>Escaneá el QR (o abrí el enlace) en el celular que va a filmar el marcador.</li>
              <li>Tocá <em>Prender cámara</em> y aceptá el permiso.</li>
              <li>Arrastrá cada recuadro sobre su dato: reloj, puntos, cuarto, faltas.</li>
              <li>Tocá <em>Recuadros fijos</em> y dejá el celular quieto (ideal: trípode).</li>
            </ol>
            <div className="pmc-enlace">
              <input readOnly value={enlace} onFocus={(e) => e.target.select()} aria-label="Enlace del lector" />
              <button className="btn-secundario btn-chico" disabled={!enlace} onClick={copiar}>{copiado ? '✓ Copiado' : 'Copiar'}</button>
            </div>
            <small className="texto-tenue">No pide iniciar sesión y solo sirve para este partido. Vence en 7 días (se genera uno nuevo cada vez que abrís este panel).</small>
            {esLocal && (
              <small className="pmc-advertencia">
                Estás en <code>localhost</code>: el celular no puede abrir esta dirección y la cámara exige https. Usá el
                enlace desde la app publicada.
              </small>
            )}
          </div>
        </div>

        <button className="btn-secundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}
