import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, getToken } from '../api/client';
import { crearSocket } from '../socket';
import EquipoRoster from '../components/EquipoRoster';
import './mesa.css';

const TIPOS_FALTA = [
  { id: 'personal', etiqueta: 'Personal' },
  { id: 'tecnica', etiqueta: 'Técnica' },
  { id: 'antideportiva', etiqueta: 'Antideportiva' },
  { id: 'descalificante', etiqueta: 'Descalificante' },
];
const COMBOS_TIRO_LIBRE = [
  { convertidos: 0, intentos: 1 }, { convertidos: 1, intentos: 1 },
  { convertidos: 0, intentos: 2 }, { convertidos: 1, intentos: 2 }, { convertidos: 2, intentos: 2 },
  { convertidos: 0, intentos: 3 }, { convertidos: 1, intentos: 3 }, { convertidos: 2, intentos: 3 }, { convertidos: 3, intentos: 3 },
];

const formatearReloj = (totalSegundos = 0) => {
  const segurosTotal = Math.max(0, Number(totalSegundos) || 0);
  const minutos = Math.floor(segurosTotal / 60);
  const segundos = segurosTotal % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
};

const etiquetaPeriodo = (periodo = 1) => (periodo <= 4 ? `Q${periodo}` : `OT${periodo - 4}`);
const PERIODOS_DISPONIBLES = [1, 2, 3, 4, 5, 6, 7];

// Se prende brevemente cuando `valor` cambia (p. ej. los timeouts restantes
// de un equipo bajan en 1 al pedir uno) — sirve para destacar un instante
// quién acaba de pedir el tiempo muerto, sin depender de quién lo tocó (así
// funciona igual si la acción vino de otra pantalla conectada al mismo
// partido).
function useDestaque(valor, duracionMs = 1800) {
  const anteriorRef = useRef(valor);
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    if (anteriorRef.current !== valor) {
      anteriorRef.current = valor;
      setActivo(true);
      const t = setTimeout(() => setActivo(false), duracionMs);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return activo;
}

function ModalFalta({ onElegir, onCerrar }) {
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="tarjeta modal-caja" onClick={(e) => e.stopPropagation()}>
        <h3>Tipo de falta</h3>
        <div className="fila-form">
          {TIPOS_FALTA.map((t) => (
            <button key={t.id} className="btn-secundario" onClick={() => onElegir(t.id)}>{t.etiqueta}</button>
          ))}
        </div>
        <button className="btn-link" onClick={onCerrar}>Cancelar</button>
      </div>
    </div>
  );
}

function ModalTiroLibre({ onElegir, onCerrar }) {
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="tarjeta modal-caja" onClick={(e) => e.stopPropagation()}>
        <h3>Tiros libres (convertidos/intentos)</h3>
        <div className="fila-form">
          {COMBOS_TIRO_LIBRE.map((c) => (
            <button key={`${c.convertidos}-${c.intentos}`} className="btn-secundario" onClick={() => onElegir(c)}>
              {c.convertidos}/{c.intentos}
            </button>
          ))}
        </div>
        <button className="btn-link" onClick={onCerrar}>Cancelar</button>
      </div>
    </div>
  );
}

// `forzado` (5 faltas / descalificación): no se puede cerrar clickeando
// afuera ni hay "Cancelar" — hay que elegir quién entra. La única salida es
// si la banca está vacía (no hay a quién meter), ahí sí se puede seguir sin
// cambiar para no dejar la Mesa trabada sin salida.
function ModalCambio({ banca, onElegir, onCerrar, forzado }) {
  const sinBanca = banca.length === 0;
  const sePuedeCerrar = !forzado || sinBanca;
  return (
    <div className="modal-fondo" onClick={sePuedeCerrar ? onCerrar : undefined}>
      <div className="tarjeta modal-caja" onClick={(e) => e.stopPropagation()}>
        <h3>{forzado ? '⚠ Sustitución obligatoria' : '¿Quién entra?'}</h3>
        {forzado && <p className="mensaje-error">Llegó al límite de faltas y tiene que salir de la cancha — elegí quién entra.</p>}
        <ul className="lista-seleccion">
          {banca.map((j) => (
            <li key={j.id}>
              <button className="btn-secundario" style={{ width: '100%' }} onClick={() => onElegir(j.id)}>
                <span className="dorsal-chip">{j.dorsal ?? '-'}</span> {j.nombre}
              </button>
            </li>
          ))}
          {sinBanca && <li className="texto-tenue">No hay jugadores en la banca.</li>}
        </ul>
        {sePuedeCerrar && (
          <button className="btn-link" onClick={onCerrar}>{forzado ? 'Seguir sin cambiar (no hay banca)' : 'Cancelar'}</button>
        )}
      </div>
    </div>
  );
}

function ModalResumen({ partido, onCerrar }) {
  const fila = (j) => (
    <tr key={j.id}>
      <td>{j.dorsal ?? '-'}</td>
      <td style={{ textAlign: 'left' }}>{j.nombre}</td>
      <td>{j.pts}</td>
      <td>{j.reb}</td>
      <td>{j.ast}</td>
      <td>{j.stl}</td>
      <td>{j.to}</td>
      <td>{j.faltas}</td>
      <td>{formatearReloj(j.segundosJugados)}</td>
    </tr>
  );

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="tarjeta modal-caja" style={{ width: 'min(640px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h3>Resumen del partido</h3>
        {[partido.equipoLocal, partido.equipoVisita].map((equipo) => (
          <div key={equipo.id} style={{ marginBottom: 16 }}>
            <strong>{equipo.nombre}</strong>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 6 }}>
              <thead>
                <tr className="texto-tenue"><th>#</th><th style={{ textAlign: 'left' }}>Jugador</th><th>PTS</th><th>REB</th><th>AST</th><th>ROB</th><th>PÉR</th><th>FAL</th><th>MIN</th></tr>
              </thead>
              <tbody>{equipo.roster.map(fila)}</tbody>
            </table>
          </div>
        ))}
        <button className="btn-secundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

// Ventana flotante compartida para nómina y quinteto — el contenido real
// (EquipoRoster, en uno u otro modo) ya trae su propia tarjeta con título,
// así que acá solo se pone el fondo/tamaño del modal y el botón de cerrar.
function ModalRoster({ onCerrar, children }) {
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        {children}
        <button className="btn-secundario" style={{ width: '100%', marginTop: 10 }} onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

function contrasteTexto(hex) {
  const limpio = String(hex || '').replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(limpio)) return '#fff';
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const luminancia = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminancia > 0.6 ? '#111' : '#fff';
}

function claseFaltas(faltas) {
  if (faltas >= 5) return 'critica';
  if (faltas >= 4) return 'alta';
  return '';
}

function BotonDorsal({ jugador, color, variante = 'cancha', seleccionado, interactivo, onClick }) {
  const estilo = { background: color, borderColor: color, color: contrasteTexto(color) };
  return (
    <button
      type="button"
      className={`${variante === 'cancha' ? 'mv-oncourt-btn' : 'mv-banco-btn'} ${seleccionado ? 'seleccionado' : ''} ${jugador.descalificado ? 'bloqueado' : ''}`}
      style={estilo}
      onClick={interactivo ? () => onClick(jugador.id) : undefined}
      title={`#${jugador.dorsal ?? '-'} ${jugador.nombre}`}
    >
      <span className={variante === 'cancha' ? 'mv-oncourt-dorsal' : 'mv-banco-dorsal'}>#{jugador.dorsal ?? '-'}</span>
      {jugador.faltas > 0 && <span className={`mv-badge-faltas ${claseFaltas(jugador.faltas)}`}>{jugador.faltas}</span>}
    </button>
  );
}

function VacanteDorsal() {
  return (
    <div className="mv-oncourt-btn vacante">
      <span className="mv-oncourt-dorsal">--</span>
    </div>
  );
}

// Pedido de tiempo muerto, en el borde externo de la caja de CADA equipo
// (antes vivía como un botón "TM Local/Visita" aparte, lejos del nombre del
// equipo) — muestra cuántos quedan (3 puntos) y a la vez es el botón para
// pedir uno. `destacado` lo resalta un rato justo después de pedirse.
function BotonTimeout({ restantes, onClick, destacado }) {
  return (
    <button
      type="button"
      className={`mv-to-btn ${destacado ? 'destacado' : ''}`}
      disabled={restantes <= 0}
      onClick={onClick}
      title="Pedir tiempo muerto"
    >
      <span className="mv-to-btn-dots">
        {[0, 1, 2].map((i) => <span key={i} className={`mv-to-dot ${i < restantes ? 'lleno' : ''}`} />)}
      </span>
      <span className="mv-to-btn-etq">TM</span>
    </button>
  );
}

// Corrección manual del marcador — para arreglar un error de carga sin
// tener que deshacer jugada por jugada. Solo acepta dígitos: se limpia todo
// lo que no sea número apenas se escribe, así nunca se puede mandar texto.
function PuntosCorregibles({ valor, editando, valorEdit, onEmpezar, onCambiarValor, onConfirmar, onCancelar }) {
  if (editando) {
    return (
      <span className="mv-pts-edit">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="999"
          autoFocus
          value={valorEdit}
          onChange={(e) => onCambiarValor(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirmar();
            if (e.key === 'Escape') onCancelar();
          }}
        />
        <button type="button" className="mv-pts-edit-btn ok" title="Guardar" onClick={onConfirmar}>✓</button>
        <button type="button" className="mv-pts-edit-btn cancelar" title="Cancelar" onClick={onCancelar}>✕</button>
      </span>
    );
  }
  return (
    <span className="mv-pts-wrap">
      <h1 className="mv-equipo-pts">{valor}</h1>
      <button type="button" className="mv-pts-corregir" title="Corregir marcador" onClick={onEmpezar}>✎</button>
    </span>
  );
}

// Gestión avanzada: solo cambiar qué diseño usa el marcador — disparar
// nómina/estadísticas y copiar el enlace viven en la pantalla principal de
// la Mesa (ver más abajo), no hace falta abrir este panel para eso.
function PanelEscenas({ escenas, disenos, onCambio }) {
  const cambiarDiseno = async (escena, disenoId) => {
    await api.actualizarEscena(escena.id, { diseno_id: disenoId });
    onCambio();
  };

  const escenaMarcador = escenas.find((e) => e.tipo === 'marcador');
  if (!escenaMarcador) return null;

  return (
    <div className="panel-jugadores">
      <h2>Gestión de escenas</h2>
      <div className="fila-form" style={{ background: 'rgba(10,132,255,.08)', borderRadius: 10, padding: '10px 12px' }}>
        <strong>🔗 Diseño del marcador</strong>
        <select
          value={escenaMarcador.diseno_id || ''}
          onChange={(ev) => cambiarDiseno(escenaMarcador, ev.target.value ? Number(ev.target.value) : null)}
          title="Diseño (colores/tipografía/opciones) que usa este marcador"
        >
          <option value="">Clásico (sin personalizar)</option>
          {disenos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>
    </div>
  );
}

// `partidoId`/`embebido` existen para poder mostrar la Mesa embebida dentro
// de "Personalizar diseño → Juego en vivo" (mismo componente, sin navegar a
// otra página) además de la ruta propia /mesa/:id — si viene `partidoId` por
// prop, gana sobre el parámetro de la URL. `onPartidoCambio` (opcional) le
// avisa a quien la embebe cada vez que cambia el estado en vivo del
// partido — lo usa "Personalizar tablero" para que su vista previa muestre
// el marcador REAL en curso en vez de datos de muestra, sin abrir una
// segunda conexión de socket aparte.
export default function Mesa({ partidoId, embebido = false, onPartidoCambio }) {
  const { id: idDeRuta } = useParams();
  const id = partidoId || idDeRuta;
  const [partido, setPartido] = useState(null);
  const [rosterLocalCompleto, setRosterLocalCompleto] = useState([]);
  const [rosterVisitaCompleto, setRosterVisitaCompleto] = useState([]);
  const [error, setError] = useState('');
  const [accionPendiente, setAccionPendiente] = useState(null);
  const [jugadas, setJugadas] = useState([]);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);
  // Interruptor manual, independiente de Nómina/Estadísticas — decide si el
  // marcador se ve o no en la transmisión AHORA MISMO, a criterio de quien
  // maneja la Mesa (por ejemplo, apagarlo en un corte publicitario). No se
  // guarda en la base (como nomina_pulso/stats_pulso, es un estado en vivo,
  // no una regla del partido) — se emite por socket a quien esté mirando.
  const [marcadorOculto, setMarcadorOculto] = useState(false);
  const [mostrarGestionEscenas, setMostrarGestionEscenas] = useState(false);
  const [escenas, setEscenas] = useState([]);
  const [disenos, setDisenos] = useState([]);
  const [equipoActivo, setEquipoActivo] = useState('local');
  const [jugadorSeleccionadoId, setJugadorSeleccionadoId] = useState(null);
  const [copiadoFooter, setCopiadoFooter] = useState(null);
  const [editandoPuntos, setEditandoPuntos] = useState(null);
  const [valorPuntosEdit, setValorPuntosEdit] = useState('');
  // null | 'local' | 'visita' — cuál equipo tiene abierta la ventana
  // flotante de nómina/quinteto (una por vez, se puede volver a abrir
  // cuando haga falta, p. ej. al empezar cada cuarto).
  const [modalNomina, setModalNomina] = useState(null);
  const [modalQuinteto, setModalQuinteto] = useState(null);
  const [detalleJugadores, setDetalleJugadores] = useState(false);
  // Al disparar Nómina/Estadísticas: si se tapa el marcador base mientras
  // esa capa está en pantalla, o se lo deja visible debajo (por defecto).
  const [ocultarMarcador, setOcultarMarcador] = useState(false);
  // null = todavía no se sabe; 0+ = cuántas fuentes (OBS u otro navegador)
  // están mirando el enlace del marcador ahora mismo.
  const [viewersMarcador, setViewersMarcador] = useState(null);
  const socketRef = useRef(null);
  const mesaEnVivoRef = useRef(null);
  const escenaMarcadorTokenRef = useRef(null);

  const cargarEscenas = () => {
    api.listarEscenas(id).then((d) => setEscenas(d.escenas));
    api.listarDisenos().then((d) => setDisenos(d.disenos));
  };

  // "Pantalla completa" agranda la Mesa de control (el tablero de acciones)
  // — el marcador con animaciones para OBS vive únicamente en su propio
  // enlace de escena, nunca acá. La fuente de verdad es ESTE estado propio,
  // no la Fullscreen API nativa del navegador: en tablets (sobre todo iOS
  // Safari) esa API suele fallar, no existir, o simplemente no cubrir toda
  // la pantalla — así que el CSS (.mv-pantalla-completa, ver mesa.css) hace
  // el trabajo de verdad con position:fixed, y la API nativa se intenta
  // solo como beneficio extra donde esté disponible.
  useEffect(() => {
    const alCambiar = () => {
      // Si se sale de la pantalla completa NATIVA desde afuera (Esc,
      // gesto del sistema), se apaga también el modo propio — pero si la
      // nativa nunca llegó a activarse (no soportada), este evento no
      // dispara nunca, así que no interfiere con el estado propio.
      if (!document.fullscreenElement) setEnPantallaCompleta(false);
    };
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const alternarPantallaCompleta = () => {
    const activar = !enPantallaCompleta;
    setEnPantallaCompleta(activar);
    try {
      if (activar) mesaEnVivoRef.current?.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch {
      // Fullscreen API no disponible — no importa, el modo propio (CSS) ya
      // se activó arriba y es el que de verdad hace que "quede solo la
      // mesa" en pantalla.
    }
  };

  const alternarVisibilidadMarcador = () => {
    const nuevoOculto = !marcadorOculto;
    setMarcadorOculto(nuevoOculto);
    emitirAccion('MARCADOR_VISIBILIDAD', { oculto: nuevoOculto });
  };

  const finalizarPartido = () => {
    if (!window.confirm('¿Finalizar el partido? Podés reiniciarlo después si hace falta jugar otro con el mismo enlace.')) return;
    emitirAccion('ESTADO_PARTIDO', { estado: 'finalizado' });
  };

  useEffect(() => {
    let activo = true;
    api.obtenerPartido(id).then(async (d) => {
      if (!activo) return;
      setPartido(d.partido);
      const [local, visita] = await Promise.all([
        api.listarJugadores(d.partido.equipoLocal.id),
        api.listarJugadores(d.partido.equipoVisita.id),
      ]);
      if (!activo) return;
      setRosterLocalCompleto(local.jugadores);
      setRosterVisitaCompleto(visita.jugadores);
      cargarEscenas();

      const socket = crearSocket();
      socketRef.current = socket;
      socket.on('connect', () => socket.emit('unirse_mesa', { publicToken: d.partido.publicToken }));
      socket.on('estado', (estado) => setPartido(estado));
      socket.on('jugada', (jugada) => setJugadas((prev) => [jugada, ...prev].slice(0, 30)));
      socket.on('error_marcador', (payload) => setError(payload.error));
      // Cuántas fuentes (OBS u otro navegador) están mirando el enlace del
      // marcador AHORA — el servidor avisa solo cada vez que alguien entra o
      // sale de esa escena puntual (ver escenaMarcadorTokenRef más abajo,
      // que se pide apenas se sabe cuál es el token de esa escena).
      socket.on('escena_viewers', ({ escenaToken, cantidad }) => {
        if (escenaToken === escenaMarcadorTokenRef.current) setViewersMarcador(cantidad);
      });
    });

    return () => {
      activo = false;
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Apenas se sabe cuál es la escena de marcador (recién cargan las
  // escenas, o cambian), se pide el conteo actual — así no hay que esperar
  // a que alguien entre/salga para enterarse de que ya había gente mirando.
  useEffect(() => {
    const escenaMarcador = escenas.find((e) => e.tipo === 'marcador');
    escenaMarcadorTokenRef.current = escenaMarcador?.public_token || null;
    if (escenaMarcador && socketRef.current) {
      socketRef.current.emit('consultar_viewers', { escenaToken: escenaMarcador.public_token });
    }
  }, [escenas]);

  const emitirAccion = (tipo, payload = {}) => {
    if (!socketRef.current || !partido) return;
    socketRef.current.emit('accion', { publicToken: partido.publicToken, tipo, token: getToken(), payload });
  };

  const destacarTimeoutLocal = useDestaque(partido?.timeoutsLocal);
  const destacarTimeoutVisita = useDestaque(partido?.timeoutsVisita);

  const empezarCorreccionPuntos = (equipo) => {
    setEditandoPuntos(equipo);
    setValorPuntosEdit(String(equipo === 'local' ? partido.ptsLocal : partido.ptsVisita));
  };
  const confirmarCorreccionPuntos = () => {
    const puntos = Number(valorPuntosEdit);
    if (Number.isInteger(puntos) && puntos >= 0) {
      emitirAccion('PUNTOS_CORREGIR', { equipo: editandoPuntos, puntos });
    }
    setEditandoPuntos(null);
  };
  const cancelarCorreccionPuntos = () => setEditandoPuntos(null);

  // Vuelve el marcador/faltas/reloj/estadísticas a cero SIN crear un partido
  // nuevo — el enlace de transmisión (mismo public_token) no cambia, así que
  // sirve para arrancar otro juego reusando el mismo enlace ya cargado en OBS.
  const reiniciarPartido = () => {
    if (!window.confirm('¿Reiniciar el partido? Vuelve el marcador, faltas, reloj y estadísticas a cero. El enlace de transmisión no cambia.')) return;
    emitirAccion('PARTIDO_REINICIAR');
    setJugadas([]);
  };

  // En cuanto alguien en cancha llega a 5 faltas (o se descalifica por
  // técnicas/antideportivas), se obliga a elegir su cambio ya mismo — antes
  // esto era solo un cartel de aviso, sin forzar nada. Tiene que ir ANTES
  // del "if (!partido) return" de más abajo (las reglas de hooks no dejan
  // llamar useEffect después de un return condicional), así que acá se
  // recalcula quién está descalificado en cancha de forma autónoma, sin usar
  // los helpers que se definen más abajo.
  useEffect(() => {
    if (!partido) return;
    const descalificados = [
      ...partido.equipoLocal.roster.filter((j) => partido.quintetoLocalIds.includes(j.id) && j.descalificado).map((j) => ({ ...j, equipo: 'local' })),
      ...partido.equipoVisita.roster.filter((j) => partido.quintetoVisitaIds.includes(j.id) && j.descalificado).map((j) => ({ ...j, equipo: 'visita' })),
    ];
    if (descalificados.length === 0) return;
    const primero = descalificados[0];
    setAccionPendiente((actual) => {
      if (actual?.tipo === 'CAMBIO' && actual?.forzado && actual?.jugadorId === primero.id) return actual;
      return { tipo: 'CAMBIO', equipo: primero.equipo, jugadorId: primero.id, forzado: true };
    });
  }, [partido]);

  useEffect(() => {
    onPartidoCambio?.(partido);
  }, [partido, onPartidoCambio]);

  if (!partido) {
    return embebido ? <p className="texto-tenue">Cargando partido…</p> : <div className="pagina-centrada">Cargando partido…</div>;
  }

  const rosterConStats = (equipoKey) => {
    const rosterCompleto = equipoKey === 'local' ? rosterLocalCompleto : rosterVisitaCompleto;
    const rosterStats = equipoKey === 'local' ? partido.equipoLocal.roster : partido.equipoVisita.roster;
    const statsPorId = new Map(rosterStats.map((j) => [j.id, j]));
    return rosterCompleto.map((j) => ({ ...j, ...(statsPorId.get(j.id) || {}) }));
  };

  const enCanchaDelEquipo = (equipoKey) => {
    const quinteto = equipoKey === 'local' ? partido.quintetoLocalIds : partido.quintetoVisitaIds;
    return rosterConStats(equipoKey).filter((j) => quinteto.includes(j.id));
  };

  const bancaDelEquipo = (equipoKey) => {
    const quinteto = equipoKey === 'local' ? partido.quintetoLocalIds : partido.quintetoVisitaIds;
    return rosterConStats(equipoKey).filter((j) => !quinteto.includes(j.id));
  };

  // Quién arranca en cancha se elige (y se puede volver a elegir en
  // cualquier momento, p. ej. al empezar cada cuarto) desde acá — ya no se
  // pide al armar los equipos en Personalizar diseño.
  const cambiarQuinteto = (equipoKey, ids) => {
    emitirAccion('QUINTETO_ACTUALIZAR', {
      quintetoLocalIds: equipoKey === 'local' ? ids : partido.quintetoLocalIds,
      quintetoVisitaIds: equipoKey === 'visita' ? ids : partido.quintetoVisitaIds,
    });
  };

  const elegirEquipoActivo = (equipoKey) => {
    setEquipoActivo(equipoKey);
    setJugadorSeleccionadoId(null);
  };

  // Tocar cualquier jugador/a en cancha (sea local o visita) habilita
  // automáticamente las acciones de SU equipo — ya no hace falta tocar
  // primero "Acciones Local"/"Acciones Visita" para que el botón responda.
  const elegirJugador = (equipoKey, jugadorId) => {
    if (equipoActivo === equipoKey && jugadorSeleccionadoId === jugadorId) {
      setJugadorSeleccionadoId(null);
    } else {
      setEquipoActivo(equipoKey);
      setJugadorSeleccionadoId(jugadorId);
    }
  };

  const jugadorSeleccionado = enCanchaDelEquipo(equipoActivo).find((j) => j.id === jugadorSeleccionadoId) || null;

  // Juego rápido: si el equipo activo no tiene plantel cargado, las acciones
  // se registran a nivel de equipo (jugadorId null) — no hace sentido exigir
  // elegir un jugador que no existe. Con plantel, se sigue pidiendo elegirlo
  // (así se mantienen las estadísticas por jugador).
  const equipoActivoTieneRoster = (equipoActivo === 'local' ? rosterLocalCompleto : rosterVisitaCompleto).length > 0;

  const manejarAccion = (tipo, extra = {}) => {
    if (equipoActivoTieneRoster && !jugadorSeleccionadoId) return;
    if (tipo === 'CAMBIO') {
      if (!jugadorSeleccionadoId) return; // el cambio sí necesita un jugador puntual que sale
      setAccionPendiente({ tipo, equipo: equipoActivo, jugadorId: jugadorSeleccionadoId });
      return;
    }
    if (tipo === 'FALTA' || tipo === 'TIRO_LIBRE') {
      setAccionPendiente({ tipo, equipo: equipoActivo, jugadorId: jugadorSeleccionadoId || null });
      return;
    }
    emitirAccion(tipo, { equipo: equipoActivo, jugadorId: jugadorSeleccionadoId || null, ...extra });
  };

  const jugadoresDescalificadosEnCancha = [
    ...enCanchaDelEquipo('local').filter((j) => j.descalificado).map((j) => ({ ...j, equipo: 'local' })),
    ...enCanchaDelEquipo('visita').filter((j) => j.descalificado).map((j) => ({ ...j, equipo: 'visita' })),
  ];

  const equipoActivoNombre = equipoActivo === 'local' ? partido.equipoLocal.nombre : partido.equipoVisita.nombre;

  const copiarLinkFooter = (token) => {
    navigator.clipboard?.writeText(`${window.location.origin}/escena/${token}`);
    setCopiadoFooter(token);
    setTimeout(() => setCopiadoFooter(null), 2000);
  };

  const escenaMarcadorActual = escenas.find((e) => e.tipo === 'marcador');

  const reproducirNomina = (modo) => emitirAccion('NOMINA_REPRODUCIR', { modo, ocultarMarcador });
  const dispararEstadisticas = (payload) => emitirAccion('ESTADISTICAS_MOSTRAR', { ...payload, ocultarMarcador });
  const jugadoresDeAmbos = [
    ...partido.equipoLocal.roster.map((j) => ({ ...j, equipoNombre: partido.equipoLocal.nombre })),
    ...partido.equipoVisita.roster.map((j) => ({ ...j, equipoNombre: partido.equipoVisita.nombre })),
  ];

  return (
    <div className={embebido ? '' : 'pagina'}>
      {error && <p className="mensaje-error">{error}</p>}

      <div className="fila-form">
        <button className="btn-secundario" onClick={() => setMostrarResumen(true)}>Ver resumen / entretiempo</button>
        <button className="btn-secundario" onClick={() => setMostrarGestionEscenas((v) => !v)}>
          {mostrarGestionEscenas ? 'Ocultar gestión de escenas' : 'Gestión avanzada de escenas'}
        </button>
      </div>

      {mostrarGestionEscenas && (
        <PanelEscenas escenas={escenas} disenos={disenos} onCambio={cargarEscenas} />
      )}

      {/* Armar equipos (nómina + quinteto) ya no pasa acá — se hace antes,
          en "Personalizar tablero → Equipos", así que el partido ya nace
          "en_curso" directo a la mesa en vivo. */}

      {partido.estado === 'en_curso' && (
        <div className={`mv-wrap ${enPantallaCompleta ? 'mv-pantalla-completa' : ''}`} ref={mesaEnVivoRef}>
          <div className="mv-topbar">
            <button className="mv-pill" onClick={alternarPantallaCompleta}>
              {enPantallaCompleta ? '✕ Salir de Pantalla Completa' : '⛶ Pantalla Completa'}
            </button>
            <button className={`mv-pill ${!marcadorOculto ? 'activa' : 'mv-pill-alerta'}`} onClick={alternarVisibilidadMarcador}>
              {marcadorOculto ? '🚫 Marcador Oculto' : '🟢 Marcador Visible'}
            </button>
            {escenaMarcadorActual && (
              <button className="mv-pill" onClick={() => copiarLinkFooter(escenaMarcadorActual.public_token)}>
                {copiadoFooter === escenaMarcadorActual.public_token ? '✓ Enlace copiado' : '🔗 Copiar enlace del marcador'}
              </button>
            )}
            {escenaMarcadorActual && (
              <span
                className={`mv-viewers ${viewersMarcador > 0 ? 'conectado' : 'desconectado'}`}
                title="Cuántas fuentes (OBS u otro navegador) tienen abierto ahora mismo el enlace del marcador"
              >
                {viewersMarcador === null
                  ? '… viendo el enlace'
                  : viewersMarcador > 0
                    ? `🟢 ${viewersMarcador} conectado${viewersMarcador === 1 ? '' : 's'}`
                    : '🔴 Nadie está mirando el enlace'}
              </span>
            )}
            <span className="mv-topbar-separador" />
            <button className="mv-pill" onClick={reiniciarPartido}>↺ Reiniciar Partido</button>
            <button className="mv-pill mv-pill-peligro" onClick={finalizarPartido}>⏹ Finalizar Partido</button>
          </div>

          {jugadoresDescalificadosEnCancha.length > 0 && (
            <div className="mensaje-error" style={{ marginBottom: 12 }}>
              Sustitución obligatoria: {jugadoresDescalificadosEnCancha.map((j) => `#${j.dorsal ?? '-'} ${j.nombre} (${j.equipo})`).join(', ')}
            </div>
          )}

          {/* Barra de marcador: los puntajes quedan siempre pegados al reloj
              central (a la derecha en Local, a la izquierda en Visita),
              nombre/logo hacia el borde exterior de la pantalla. */}
          <div className="mv-scorebar">
            <div className={`mv-equipo-box ${destacarTimeoutLocal ? 'mv-box-destacado' : ''}`} style={{ border: `1px solid ${partido.equipoLocal.color}88`, background: `${partido.equipoLocal.color}14` }}>
              <div className="mv-equipo-fila">
                <BotonTimeout restantes={partido.timeoutsLocal} destacado={destacarTimeoutLocal} onClick={() => emitirAccion('TIMEOUT', { equipo: 'local' })} />
                {partido.equipoLocal.logo_url && <img className="mv-equipo-logo" src={partido.equipoLocal.logo_url} alt="" />}
                <div className="mv-equipo-nombres">
                  <span className="mv-equipo-etiqueta" style={{ color: partido.equipoLocal.color }}>LOCAL {partido.posesion === 'local' && '◀'}</span>
                  <span className="mv-equipo-nombre">{partido.equipoLocal.nombre}</span>
                </div>
                <PuntosCorregibles
                  valor={partido.ptsLocal}
                  editando={editandoPuntos === 'local'}
                  valorEdit={valorPuntosEdit}
                  onEmpezar={() => empezarCorreccionPuntos('local')}
                  onCambiarValor={setValorPuntosEdit}
                  onConfirmar={confirmarCorreccionPuntos}
                  onCancelar={cancelarCorreccionPuntos}
                />
              </div>
              <div className="mv-equipo-pie">
                <span className="mv-faltas">F: {partido.faltasLocal}</span>
              </div>
            </div>

            <div className="mv-centro">
              <span className="mv-chip-competicion">Partido en curso</span>
              <div><span className="mv-reloj-chip">{formatearReloj(partido.relojSegundos)}</span></div>
              <h4 className="mv-periodo-label">{etiquetaPeriodo(partido.periodo)}</h4>
              <button className="mv-btn-posesion" onClick={() => emitirAccion('POSESION_TOGGLE')} title="Cambiar posesión">⇄</button>
            </div>

            <div className={`mv-equipo-box visita ${destacarTimeoutVisita ? 'mv-box-destacado' : ''}`} style={{ border: `1px solid ${partido.equipoVisita.color}88`, background: `${partido.equipoVisita.color}14` }}>
              <div className="mv-equipo-fila">
                <PuntosCorregibles
                  valor={partido.ptsVisita}
                  editando={editandoPuntos === 'visita'}
                  valorEdit={valorPuntosEdit}
                  onEmpezar={() => empezarCorreccionPuntos('visita')}
                  onCambiarValor={setValorPuntosEdit}
                  onConfirmar={confirmarCorreccionPuntos}
                  onCancelar={cancelarCorreccionPuntos}
                />
                <div className="mv-equipo-nombres">
                  <span className="mv-equipo-etiqueta" style={{ color: partido.equipoVisita.color }}>{partido.posesion === 'visita' && '▶'} VISITA</span>
                  <span className="mv-equipo-nombre">{partido.equipoVisita.nombre}</span>
                </div>
                {partido.equipoVisita.logo_url && <img className="mv-equipo-logo" src={partido.equipoVisita.logo_url} alt="" />}
                <BotonTimeout restantes={partido.timeoutsVisita} destacado={destacarTimeoutVisita} onClick={() => emitirAccion('TIMEOUT', { equipo: 'visita' })} />
              </div>
              <div className="mv-equipo-pie">
                <span className="mv-faltas">F: {partido.faltasVisita}</span>
              </div>
            </div>
          </div>

          <div className="mv-layout-grid">
            <div className="mv-zona mv-zona-local">
              <div className="mv-zona-titulo-fila">
                <p className="mv-zona-titulo">Roster Local ({rosterLocalCompleto.length}/12)</p>
                <button type="button" className="mv-btn-nomina" onClick={() => setModalNomina('local')}>+ Nómina</button>
              </div>
              <div className="mv-split local">
                <div className="mv-col exterior">
                  <h6>Banco Local ({bancaDelEquipo('local').length})</h6>
                  <div className="mv-banco-grid">
                    {bancaDelEquipo('local').map((j) => (
                      <BotonDorsal key={j.id} jugador={j} color={partido.equipoLocal.color} variante="banco" interactivo={false} />
                    ))}
                    {bancaDelEquipo('local').length === 0 && <p className="mv-texto-tenue" style={{ margin: 0 }}>Sin jugadoras/es de banca.</p>}
                  </div>
                </div>
                <div className="mv-col interior">
                  <h6>En Cancha (5) · Local</h6>
                  <div className="mv-cancha-grid">
                    {enCanchaDelEquipo('local').map((j) => (
                      <BotonDorsal
                        key={j.id}
                        jugador={j}
                        color={partido.equipoLocal.color}
                        interactivo
                        seleccionado={equipoActivo === 'local' && jugadorSeleccionadoId === j.id}
                        onClick={() => elegirJugador('local', j.id)}
                      />
                    ))}
                    {Array.from({ length: Math.max(0, 5 - enCanchaDelEquipo('local').length) }).map((_, idx) => <VacanteDorsal key={idx} />)}
                  </div>
                  <button type="button" className="mv-btn-quinteto" onClick={() => setModalQuinteto('local')}>✎ Editar quinteto</button>
                </div>
              </div>
            </div>

            <div className="mv-zona mv-zona-centro">
              <div className="mv-control-card">
                <h6>Control de Partido</h6>
                <div className="mv-control-meta">{etiquetaPeriodo(partido.periodo)} · {formatearReloj(partido.relojSegundos)}</div>
                <div className="mv-control-grid">
                  <div className="mv-control-lado">
                    <button className="mv-pill" onClick={() => emitirAccion('RELOJ_AJUSTAR', { segundos: 60 })}>+1:00</button>
                    <button className="mv-pill" onClick={() => emitirAccion('RELOJ_AJUSTAR', { segundos: -60 })}>-1:00</button>
                  </div>
                  {partido.relojCorriendo ? (
                    <button className="mv-btn-electrico" onClick={() => emitirAccion('RELOJ_PAUSAR')}>⏸ Pausar</button>
                  ) : (
                    <button className="mv-btn-electrico" onClick={() => emitirAccion('RELOJ_INICIAR')}>▶ Iniciar</button>
                  )}
                  <div className="mv-control-lado">
                    <select
                      className="mv-select"
                      value={partido.periodo}
                      onChange={(e) => emitirAccion('PERIODO_FIJAR', { periodo: Number(e.target.value) })}
                      title="Elegir el cuarto/prórroga que se está jugando"
                    >
                      {PERIODOS_DISPONIBLES.map((p) => <option key={p} value={p}>{etiquetaPeriodo(p)}</option>)}
                    </select>
                  </div>
                </div>
                <button className="mv-pill" style={{ width: '100%', marginTop: 8 }} onClick={() => emitirAccion('RELOJ_REINICIAR')}>
                  ↺ Reiniciar reloj
                </button>
              </div>

              {/* Con plantel, tocar cualquier jugador/a ya elige el equipo activo
                  solo (ver elegirJugador) — estos botones quedaban de adorno,
                  sin nada que hacer. Solo hacen falta cuando alguno de los dos
                  equipos juega "rápido" sin plantel: ahí no hay jugador que
                  tocar para activarlo, así que es la única forma de elegirlo. */}
              {(rosterLocalCompleto.length === 0 || rosterVisitaCompleto.length === 0) && (
                <div className="mv-acciones-segmentado">
                  <button className={`mv-acciones-segmento ${equipoActivo === 'local' ? 'activo' : ''}`} onClick={() => elegirEquipoActivo('local')}>
                    Acciones Local
                  </button>
                  <button className={`mv-acciones-segmento ${equipoActivo === 'visita' ? 'activo' : ''}`} onClick={() => elegirEquipoActivo('visita')}>
                    Acciones Visita
                  </button>
                </div>
              )}

              <p className={`mv-prompt ${jugadorSeleccionado || !equipoActivoTieneRoster ? 'valido' : 'invalido'}`}>
                {jugadorSeleccionado
                  ? `Control de Acciones (${equipoActivoNombre}) · #${jugadorSeleccionado.dorsal ?? '-'} ${jugadorSeleccionado.nombre}`
                  : equipoActivoTieneRoster
                    ? `Seleccione Jugador/a en Cancha (${equipoActivoNombre})`
                    : `Juego rápido — acciones para el equipo (${equipoActivoNombre}), sin jugador`}
              </p>

              <div className="fiba-botones-grid">
                <button className="btn-fiba pt" disabled={equipoActivoTieneRoster && !jugadorSeleccionadoId} onClick={() => manejarAccion('TIRO_LIBRE')}>Tiro Libre</button>
                <button className="btn-fiba pt" disabled={equipoActivoTieneRoster && !jugadorSeleccionadoId} onClick={() => manejarAccion('PUNTO', { puntos: 2 })}>+2 PTS</button>
                <button className="btn-fiba pt" disabled={equipoActivoTieneRoster && !jugadorSeleccionadoId} onClick={() => manejarAccion('PUNTO', { puntos: 3 })}>+3 PTS</button>
                <button className="btn-fiba st" disabled={equipoActivoTieneRoster && !jugadorSeleccionadoId} onClick={() => manejarAccion('REBOTE')}>REB</button>
                <button className="btn-fiba st" disabled={equipoActivoTieneRoster && !jugadorSeleccionadoId} onClick={() => manejarAccion('ASISTENCIA')}>AST</button>
                <button className="btn-fiba st" disabled={equipoActivoTieneRoster && !jugadorSeleccionadoId} onClick={() => manejarAccion('ROBO')}>ROBO</button>
                <button className="btn-fiba err" disabled={equipoActivoTieneRoster && !jugadorSeleccionadoId} onClick={() => manejarAccion('PERDIDA')}>PÉRDIDA</button>
                <button className="btn-fiba err" disabled={equipoActivoTieneRoster && !jugadorSeleccionadoId} onClick={() => manejarAccion('FALTA')}>FALTA</button>
              </div>

              <button className="mv-pill mv-btn-cambio" disabled={!jugadorSeleccionadoId} onClick={() => manejarAccion('CAMBIO')}>⇄ Cambio</button>
            </div>

            <div className="mv-zona mv-zona-visita">
              <div className="mv-zona-titulo-fila">
                <p className="mv-zona-titulo">Roster Visita ({rosterVisitaCompleto.length}/12)</p>
                <button type="button" className="mv-btn-nomina" onClick={() => setModalNomina('visita')}>+ Nómina</button>
              </div>
              <div className="mv-split">
                <div className="mv-col interior">
                  <h6>En Cancha (5) · Visita</h6>
                  <div className="mv-cancha-grid">
                    {enCanchaDelEquipo('visita').map((j) => (
                      <BotonDorsal
                        key={j.id}
                        jugador={j}
                        color={partido.equipoVisita.color}
                        interactivo
                        seleccionado={equipoActivo === 'visita' && jugadorSeleccionadoId === j.id}
                        onClick={() => elegirJugador('visita', j.id)}
                      />
                    ))}
                    {Array.from({ length: Math.max(0, 5 - enCanchaDelEquipo('visita').length) }).map((_, idx) => <VacanteDorsal key={idx} />)}
                  </div>
                  <button type="button" className="mv-btn-quinteto" onClick={() => setModalQuinteto('visita')}>✎ Editar quinteto</button>
                </div>
                <div className="mv-col exterior">
                  <h6>Banco Visita ({bancaDelEquipo('visita').length})</h6>
                  <div className="mv-banco-grid">
                    {bancaDelEquipo('visita').map((j) => (
                      <BotonDorsal key={j.id} jugador={j} color={partido.equipoVisita.color} variante="banco" interactivo={false} />
                    ))}
                    {bancaDelEquipo('visita').length === 0 && <p className="mv-texto-tenue" style={{ margin: 0 }}>Sin jugadoras/es de banca.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mv-jugadas">
            <h6>Últimas acciones</h6>
            <ul className="mv-jugadas-lista">
              {jugadas.slice(0, 3).map((j, idx) => <li key={idx}>{j.texto}</li>)}
              {jugadas.length === 0 && <li className="mv-jugadas-vacio">Todavía no hay acciones registradas.</li>}
            </ul>
          </div>

          <div className="mv-disparadores">
            <h6>Disparar en la transmisión</h6>
            <div className="fila-form">
              <span className="mv-disparadores-etiqueta">Nómina:</span>
              <button className="mv-pill" onClick={() => reproducirNomina('local')}>▶ Local</button>
              <button className="mv-pill" onClick={() => reproducirNomina('visita')}>▶ Visita</button>
              <button className="mv-pill" onClick={() => reproducirNomina('ambos')}>▶ Ambos</button>
            </div>
            <div className="fila-form">
              <span className="mv-disparadores-etiqueta">Estadísticas:</span>
              <button className="mv-pill" onClick={() => dispararEstadisticas({ modo: 'equipo', equipo: 'local', detalle: detalleJugadores })}>📊 Equipo Local</button>
              <button className="mv-pill" onClick={() => dispararEstadisticas({ modo: 'equipo', equipo: 'visita', detalle: detalleJugadores })}>📊 Equipo Visita</button>
              <button className="mv-pill" onClick={() => dispararEstadisticas({ modo: 'ambos', detalle: detalleJugadores })}>📊 Ambos Equipos</button>
              <select
                className="mv-select"
                value=""
                onChange={(ev) => { if (ev.target.value) dispararEstadisticas({ modo: 'jugador', jugadorId: Number(ev.target.value) }); }}
              >
                <option value="">📊 Jugador…</option>
                {jugadoresDeAmbos.map((j) => (
                  <option key={j.id} value={j.id}>{j.equipoNombre} — #{j.dorsal ?? '-'} {j.nombre}</option>
                ))}
              </select>
            </div>
            <label className="mv-check-detalle">
              <input type="checkbox" checked={detalleJugadores} onChange={(e) => setDetalleJugadores(e.target.checked)} />
              Incluir detalle por jugador en Equipo Local/Visita/Ambos
            </label>
            <label className="mv-check-detalle">
              <input type="checkbox" checked={ocultarMarcador} onChange={(e) => setOcultarMarcador(e.target.checked)} />
              Ocultar el marcador mientras se muestra Nómina/Estadísticas
            </label>
            <p className="mv-disparadores-etiqueta" style={{ margin: 0 }}>
              Cuántos segundos quedan visibles se ajusta por diseño, en Personalizar diseño.
            </p>
          </div>

        </div>
      )}

      {partido.estado === 'finalizado' && (
        <div className="pagina-centrada">
          <p>Este partido ya finalizó. Marcador final: {partido.ptsLocal} - {partido.ptsVisita}</p>
          <button className="btn-secundario" onClick={reiniciarPartido}>🔄 Reiniciar partido (mismo enlace)</button>
        </div>
      )}

      {accionPendiente?.tipo === 'FALTA' && (
        <ModalFalta
          onCerrar={() => setAccionPendiente(null)}
          onElegir={(tipoFalta) => {
            emitirAccion('FALTA', { equipo: accionPendiente.equipo, jugadorId: accionPendiente.jugadorId, tipoFalta });
            setAccionPendiente(null);
          }}
        />
      )}

      {accionPendiente?.tipo === 'TIRO_LIBRE' && (
        <ModalTiroLibre
          onCerrar={() => setAccionPendiente(null)}
          onElegir={(combo) => {
            emitirAccion('TIRO_LIBRE', { equipo: accionPendiente.equipo, jugadorId: accionPendiente.jugadorId, ...combo });
            setAccionPendiente(null);
          }}
        />
      )}

      {accionPendiente?.tipo === 'CAMBIO' && (
        <ModalCambio
          banca={bancaDelEquipo(accionPendiente.equipo)}
          forzado={accionPendiente.forzado}
          onCerrar={() => setAccionPendiente(null)}
          onElegir={(jugadorEntraId) => {
            emitirAccion('SUSTITUCION', { equipo: accionPendiente.equipo, jugadorSaleId: accionPendiente.jugadorId, jugadorEntraId });
            setAccionPendiente(null);
            setJugadorSeleccionadoId(null);
          }}
        />
      )}

      {mostrarResumen && <ModalResumen partido={partido} onCerrar={() => setMostrarResumen(false)} />}

      {modalNomina && (
        <ModalRoster onCerrar={() => setModalNomina(null)}>
          <EquipoRoster
            equipo={modalNomina === 'local' ? partido.equipoLocal : partido.equipoVisita}
            roster={modalNomina === 'local' ? rosterLocalCompleto : rosterVisitaCompleto}
            seleccionable={false}
            onJugadorAgregado={(j) => (modalNomina === 'local' ? setRosterLocalCompleto : setRosterVisitaCompleto)((r) => [...r, j])}
          />
        </ModalRoster>
      )}

      {modalQuinteto && (
        <ModalRoster onCerrar={() => setModalQuinteto(null)}>
          <EquipoRoster
            equipo={modalQuinteto === 'local' ? partido.equipoLocal : partido.equipoVisita}
            roster={modalQuinteto === 'local' ? rosterLocalCompleto : rosterVisitaCompleto}
            seleccionados={modalQuinteto === 'local' ? partido.quintetoLocalIds : partido.quintetoVisitaIds}
            onCambiarQuinteto={(ids) => cambiarQuinteto(modalQuinteto, ids)}
            permitirAgregar={false}
          />
        </ModalRoster>
      )}
    </div>
  );
}
