import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getToken } from '../api/client';
import { crearSocket } from '../socket';
import EquipoRoster from '../components/EquipoRoster';
import TablaEstadisticas from '../components/TablaEstadisticas';
import './mesa.css';

// Los 4 tipos de falta del reglamento FIBA vigente (personal/técnica/
// antideportiva/descalificante) + "Técnica banco/DT": no es un tipo FIBA
// nuevo, es la MISMA falta técnica pero cargada al banco/cuerpo técnico en
// vez de a un jugador en cancha — no cuenta para las 5 personales de nadie,
// así que conviene poder cargarla sin tener que "elegir" a algún jugador
// solo para poder anotarla. `sinJugador` hace que, al dispararla, se mande
// siempre jugadorId null sin importar qué jugador esté seleccionado en ese
// momento (ver disparar() en PanelAcciones).
const TIPOS_FALTA = [
  { id: 'personal', etiqueta: 'Personal' },
  { id: 'tecnica', etiqueta: 'Técnica' },
  { id: 'tecnica_banco', etiqueta: 'Técnica banco/DT', sinJugador: true },
  { id: 'antideportiva', etiqueta: 'Antideportiva' },
  { id: 'descalificante', etiqueta: 'Descalificante' },
];
const COMBOS_TIRO_LIBRE = [
  { convertidos: 0, intentos: 1 }, { convertidos: 1, intentos: 1 },
  { convertidos: 0, intentos: 2 }, { convertidos: 1, intentos: 2 }, { convertidos: 2, intentos: 2 },
  { convertidos: 0, intentos: 3 }, { convertidos: 1, intentos: 3 }, { convertidos: 2, intentos: 3 }, { convertidos: 3, intentos: 3 },
];

// Categoría/rama en la etiqueta ("Sub-15 · Femenino — Halcones") para poder
// distinguir equipos del mismo club sin adivinar — mismo criterio que
// EquipoFicha.jsx (ver etiquetaEquipoGuardado ahí).
function etiquetaEquipoGuardado(e) {
  const detalle = [e.categoria, e.rama === 'femenino' ? 'Femenino' : e.rama === 'masculino' ? 'Masculino' : null]
    .filter(Boolean)
    .join(' · ');
  return `${detalle ? `${detalle} — ` : ''}${e.nombre}`;
}

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

function ModalTiroLibre({ onElegir, onCerrar }) {
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <h3>Tiros libres (convertidos/intentos)</h3>
        <div className="modal-opciones-grid">
          {COMBOS_TIRO_LIBRE.map((c) => (
            <button key={`${c.convertidos}-${c.intentos}`} className="modal-opcion-btn" onClick={() => onElegir(c)}>
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
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <h3>{forzado ? '⚠ Sustitución obligatoria' : '¿Quién entra?'}</h3>
        {forzado && <p className="mensaje-error">Llegó al límite de faltas y tiene que salir de la cancha — elegí quién entra.</p>}
        <ul className="modal-lista-filas">
          {banca.map((j) => (
            <li key={j.id}>
              <button className="modal-fila-btn" onClick={() => onElegir(j.id)}>
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
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja" style={{ width: 'min(640px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h3>Resumen del partido</h3>
        <TablaEstadisticas equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} />
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

const RAMA_OPCIONES = [
  { value: '', label: 'Todas las ramas' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
];

// Buscador de equipo guardado para copiar su nómina — antes era un <select>
// plano con TODOS los equipos del usuario mezclados; un club con muchas
// categorías/ramas ("Cultura Sub-13 Femenino", "Cultura Sub-15 Masculino",
// etc.) se volvía imposible de navegar ahí. Acá se busca por nombre/
// categoría de texto libre, y se puede acotar más por rama/categoría en
// desplegables aparte. Si ninguno de los guardados es el que hace falta,
// "+ Crear equipo nuevo" arma uno (nombre + categoría + rama, igual que en
// "Equipos") y deja cargarle la nómina ahí mismo (dorsal solo o dorsal +
// nombre, misma lógica de siempre) antes de usarlo para el partido — ese
// equipo queda guardado de verdad, reusable después desde cualquier lado,
// no es algo temporal solo para hoy.
function ModalElegirEquipo({ equipos, equipoActualId, onUsar, onCerrar }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRama, setFiltroRama] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [categoriaNueva, setCategoriaNueva] = useState('');
  const [ramaNueva, setRamaNueva] = useState('');
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [equipoNuevo, setEquipoNuevo] = useState(null);
  const [rosterNuevo, setRosterNuevo] = useState([]);
  const [error, setError] = useState('');

  const disponibles = equipos.filter((e) => e.id !== equipoActualId && e.jugadores_count > 0);
  const categoriasDisponibles = [...new Set(disponibles.map((e) => e.categoria).filter(Boolean))].sort();

  const filtrados = disponibles
    .filter((e) => {
      const texto = busqueda.trim().toLowerCase();
      const coincideTexto = !texto || e.nombre.toLowerCase().includes(texto) || (e.categoria || '').toLowerCase().includes(texto);
      const coincideRama = !filtroRama || e.rama === filtroRama;
      const coincideCategoria = !filtroCategoria || e.categoria === filtroCategoria;
      return coincideTexto && coincideRama && coincideCategoria;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const crearEquipoNuevo = async (e) => {
    e.preventDefault();
    if (!nombreNuevo.trim()) return setError('Poné al menos el nombre del equipo');
    setError('');
    setGuardandoNuevo(true);
    try {
      const { equipo } = await api.crearEquipo({
        nombre: nombreNuevo.trim(),
        color: '#0a84ff',
        categoria: categoriaNueva.trim() || null,
        rama: ramaNueva || null,
      });
      setEquipoNuevo(equipo);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoNuevo(false);
    }
  };

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja mv-modal-elegir-equipo" onClick={(e) => e.stopPropagation()}>
        {error && <p className="mensaje-error">{error}</p>}

        {!creando ? (
          <>
            <h3>Elegir nómina de un equipo guardado</h3>
            <input
              className="mv-buscador-equipo"
              placeholder="Buscar por nombre o categoría…"
              value={busqueda}
              onChange={(ev) => setBusqueda(ev.target.value)}
              autoFocus
            />
            <div className="fila-form" style={{ marginTop: 8 }}>
              <select value={filtroRama} onChange={(ev) => setFiltroRama(ev.target.value)}>
                {RAMA_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={filtroCategoria} onChange={(ev) => setFiltroCategoria(ev.target.value)}>
                <option value="">Todas las categorías</option>
                {categoriasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <ul className="modal-lista-filas mv-lista-equipos" style={{ marginTop: 12 }}>
              {filtrados.map((e) => (
                <li key={e.id}>
                  <button type="button" className="modal-fila-btn" onClick={() => onUsar(e.id)}>
                    <span style={{ flex: 1 }}>{etiquetaEquipoGuardado(e)}</span>
                    <span className="texto-tenue">{e.jugadores_count}</span>
                  </button>
                </li>
              ))}
              {filtrados.length === 0 && <li className="texto-tenue">Ningún equipo guardado coincide con la búsqueda.</li>}
            </ul>

            <button type="button" className="btn-secundario" style={{ width: '100%', marginTop: 12 }} onClick={() => setCreando(true)}>
              + Crear equipo nuevo
            </button>
          </>
        ) : !equipoNuevo ? (
          <>
            <h3>Crear equipo nuevo</h3>
            <form className="fila-form" style={{ flexWrap: 'wrap' }} onSubmit={crearEquipoNuevo}>
              <input placeholder="Nombre del equipo" value={nombreNuevo} onChange={(ev) => setNombreNuevo(ev.target.value)} style={{ flex: 1, minWidth: 160 }} autoFocus />
              <input placeholder="Categoría (ej. Sub-15)" value={categoriaNueva} onChange={(ev) => setCategoriaNueva(ev.target.value)} style={{ maxWidth: 150 }} />
              <select value={ramaNueva} onChange={(ev) => setRamaNueva(ev.target.value)} style={{ maxWidth: 150 }}>
                <option value="">Rama (opcional)</option>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
              </select>
              <button className="btn-secundario" type="submit" disabled={guardandoNuevo}>{guardandoNuevo ? 'Creando…' : 'Crear'}</button>
            </form>
            <button type="button" className="btn-link" onClick={() => setCreando(false)}>← Volver a buscar</button>
          </>
        ) : (
          <>
            {/* EquipoRoster ya trae su propio <h3>{equipo.nombre}</h3> —
                acá no hace falta otro título repitiendo lo mismo arriba. */}
            <EquipoRoster
              equipo={equipoNuevo}
              roster={rosterNuevo}
              seleccionable={false}
              onJugadorAgregado={(j) => setRosterNuevo((r) => [...r, j])}
              permitirEliminar
              onJugadorEliminado={(id) => setRosterNuevo((r) => r.filter((x) => x.id !== id))}
              permitirEditar
              onJugadorEditado={(actualizado) => setRosterNuevo((r) => r.map((x) => (x.id === actualizado.id ? actualizado : x)))}
            />
            <button
              type="button"
              className="btn-primario"
              style={{ width: '100%', marginTop: 12 }}
              disabled={rosterNuevo.length === 0}
              onClick={() => onUsar(equipoNuevo.id)}
            >
              Usar esta nómina para el partido
            </button>
          </>
        )}

        <button className="btn-link" style={{ marginTop: 10 }} onClick={onCerrar}>Cerrar</button>
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
      title="Pedir tiempo muerto — descuenta uno y muestra MINUTO SOLICITADO en la transmisión un rato"
    >
      <span className="mv-to-btn-dots">
        {[0, 1, 2].map((i) => <span key={i} className={`mv-to-dot ${i < restantes ? 'lleno' : ''}`} />)}
      </span>
      <span className="mv-to-btn-etq">TM</span>
    </button>
  );
}

const PASO_RUEDA_SEGUNDOS = 5;
// Cuánto deltaY (px) de la rueda del mouse/trackpad hace falta acumular
// para que dispare un paso — un mouse con rueda "de a clicks" manda ±100
// por click (dispara enseguida), un trackpad manda de a poco y seguido (se
// va acumulando hasta juntar lo mismo).
const ALTO_MUESCA_RUEDA_MOUSE = 40;

// Mantener apretado ▲/▼ repite el ajuste solo (arranca a los 380ms, después
// cada 110ms) — con un simple toque no alcanza para corregir varios
// segundos rápido en medio de un partido en vivo. Se probó antes una rueda
// para arrastrar con el dedo (mango que sube/baja y vuelve solo al
// centro) — resultó poco práctica al usarla de verdad (hay que calibrar la
// distancia del arrastre cada vez, en vez de un toque directo y previsible),
// así que quedan botones simples, con una animación de "pulso" más marcada
// al soltar para que se sienta más satisfactorio tocarlos.
function useMantenerPulsado(callback) {
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const detener = () => {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
  };
  const empezar = (e) => {
    e.preventDefault();
    callback();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(callback, 110);
    }, 380);
  };
  useEffect(() => detener, []);
  return { onPointerDown: empezar, onPointerUp: detener, onPointerLeave: detener, onPointerCancel: detener };
}

function RuedaReloj({ segundos, corriendo, editando, minutosEdit, segundosEdit, onCambiarMinutos, onCambiarSegundos, onEmpezarEdicion, onConfirmarEdicion, onCancelarEdicion, onAjustar, onReiniciar }) {
  const [pulsoBoton, setPulsoBoton] = useState(null);
  const acumuladoRuedaRef = useRef(0);
  const pulsoTimeoutRef = useRef(null);
  const controlRef = useRef(null);
  const onAjustarRef = useRef(onAjustar);
  onAjustarRef.current = onAjustar;
  const editandoRef = useRef(editando);
  editandoRef.current = editando;

  const destellar = (lado) => {
    setPulsoBoton(lado);
    clearTimeout(pulsoTimeoutRef.current);
    pulsoTimeoutRef.current = setTimeout(() => setPulsoBoton(null), 220);
  };

  const subir = useMantenerPulsado(() => { onAjustar(PASO_RUEDA_SEGUNDOS); destellar('arriba'); });
  const bajar = useMantenerPulsado(() => { onAjustar(-PASO_RUEDA_SEGUNDOS); destellar('abajo'); });

  // Rueda de mouse/trackpad de verdad: girarla arriba de los botones ajusta
  // el reloj sin tener que tocar nada — cómodo en escritorio, además del
  // toque en celular/tablet. Va con addEventListener nativo (no onWheel de
  // React) para poder llamar preventDefault de verdad y que no se
  // scrollee la página al girarla arriba de la Mesa.
  useEffect(() => {
    const el = controlRef.current;
    if (!el) return undefined;
    const manejarRueda = (e) => {
      if (editandoRef.current) return;
      e.preventDefault();
      acumuladoRuedaRef.current += e.deltaY;
      while (acumuladoRuedaRef.current <= -ALTO_MUESCA_RUEDA_MOUSE) {
        onAjustarRef.current(PASO_RUEDA_SEGUNDOS);
        acumuladoRuedaRef.current += ALTO_MUESCA_RUEDA_MOUSE;
        destellar('arriba');
      }
      while (acumuladoRuedaRef.current >= ALTO_MUESCA_RUEDA_MOUSE) {
        onAjustarRef.current(-PASO_RUEDA_SEGUNDOS);
        acumuladoRuedaRef.current -= ALTO_MUESCA_RUEDA_MOUSE;
        destellar('abajo');
      }
    };
    el.addEventListener('wheel', manejarRueda, { passive: false });
    return () => el.removeEventListener('wheel', manejarRueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => clearTimeout(pulsoTimeoutRef.current), []);

  return (
    <div className="mv-rueda-reloj">
      {editando ? (
        <span className="mv-rueda-edit">
          <input
            type="number" inputMode="numeric" min="0" max="99" autoFocus
            value={minutosEdit}
            onChange={(e) => onCambiarMinutos(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onKeyDown={(e) => { if (e.key === 'Enter') onConfirmarEdicion(); if (e.key === 'Escape') onCancelarEdicion(); }}
            title="Minutos"
          />
          :
          <input
            type="number" inputMode="numeric" min="0" max="59"
            value={segundosEdit}
            onChange={(e) => onCambiarSegundos(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onKeyDown={(e) => { if (e.key === 'Enter') onConfirmarEdicion(); if (e.key === 'Escape') onCancelarEdicion(); }}
            title="Segundos"
          />
          <button type="button" className="mv-pts-edit-btn ok" title="Guardar" onClick={onConfirmarEdicion}>✓</button>
          <button type="button" className="mv-pts-edit-btn cancelar" title="Cancelar" onClick={onCancelarEdicion}>✕</button>
        </span>
      ) : (
        <button type="button" className={`mv-rueda-valor ${corriendo ? 'corriendo' : ''}`} onClick={onEmpezarEdicion} title="Tocar para escribir el minuto:segundo exacto">
          {formatearReloj(segundos)}
        </button>
      )}

      <div className="mv-rueda-fila" ref={controlRef} title="Mantener apretado para subir/bajar rápido — también funciona con la rueda del mouse">
        <button type="button" className="mv-pill mv-pill-reloj" onClick={() => onAjustar(-60)}>-1:00</button>
        <div className="mv-rueda-botones">
          <button type="button" className={`mv-rueda-btn ${pulsoBoton === 'arriba' ? 'pulso' : ''}`} title="Mantener para subir rápido — un toque suma 5s" {...subir}>▲</button>
          <button type="button" className={`mv-rueda-btn ${pulsoBoton === 'abajo' ? 'pulso' : ''}`} title="Mantener para bajar rápido — un toque resta 5s" {...bajar}>▼</button>
        </div>
        <button type="button" className="mv-pill mv-pill-reloj" onClick={() => onAjustar(60)}>+1:00</button>
      </div>

      <button type="button" className="mv-pill" style={{ width: '100%' }} onClick={onReiniciar}>↺ Reiniciar reloj</button>
    </div>
  );
}

// Corrección manual del marcador — para arreglar un error de carga sin
// tener que deshacer jugada por jugada. Solo acepta dígitos: se limpia todo
// lo que no sea número apenas se escribe, así nunca se puede mandar texto.
function PuntosCorregibles({ valor, destacado, editando, valorEdit, onEmpezar, onCambiarValor, onConfirmar, onCancelar }) {
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
      <h1 className={`mv-equipo-pts ${destacado ? 'mv-pts-pulso' : ''}`}>{valor}</h1>
      <button type="button" className="mv-pts-corregir" title="Corregir marcador" onClick={onEmpezar}>✎</button>
    </span>
  );
}

// Corrección manual de las faltas PERSONALES de un jugador — mismo patrón
// que PuntosCorregibles (lápiz → número → ✓/✕), para arreglar un error de
// carga (falta cargada al jugador equivocado, un toque de más) sin tener
// que deshacer jugada por jugada. Solo tiene sentido con un jugador puntual
// elegido — en juego rápido sin plantel no hay a quién corregirle nada acá.
function FaltasCorregibles({ valor, editando, valorEdit, onEmpezar, onCambiarValor, onConfirmar, onCancelar }) {
  if (editando) {
    return (
      <span className="mv-faltas-edit">
        Faltas personales:
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="20"
          autoFocus
          value={valorEdit}
          onChange={(e) => onCambiarValor(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
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
    <span className="mv-faltas-edit">
      Faltas personales: <strong>{valor}</strong>
      <button type="button" className="mv-pts-corregir" title="Corregir faltas personales" onClick={onEmpezar}>✎</button>
    </span>
  );
}

// Panel flotante de acciones — antes este bloque (prompt + grilla FIBA +
// Cambio) vivía fijo en la columna central de la Mesa todo el tiempo, aunque
// no hubiera nada elegido. Ahora aparece recién al elegir un jugador (o, en
// juego rápido sin plantel, al tocar "Acciones Local/Visita"), así la
// columna central queda con más lugar para el control de reloj/período.
// Centrado con fondo con blur (mv-panel-fondo), mismo lenguaje que el resto
// de los modales — antes quedaba anclado abajo de todo con position:fixed,
// y en pantallas donde la Mesa no llenaba el viewport entero (p. ej.
// pantalla completa con poco contenido) terminaba flotando lejos, ya
// desconectado visualmente de la Mesa. Se cierra solo apenas se registra
// una acción, con la ✕, o tocando afuera (mismo criterio que el resto de
// los modales).
//
// Las acciones quedan agrupadas en 3 secciones SIEMPRE visibles (tiro/
// juego/falta) — antes "FALTA" era un botón que había que tocar primero
// para recién ahí ver los tipos, así que cargar una falta pedía dos toques
// para decir lo mismo una sola vez. Ahora los 4 tipos están a la vista
// desde que se abre el panel, un solo toque alcanza.
function PanelAcciones({ equipoNombre, equipoLogoUrl, jugadorSeleccionado, equipoActivoTieneRoster, onAccion, onCerrar, faltasProps }) {
  const deshabilitado = equipoActivoTieneRoster && !jugadorSeleccionado;

  const disparar = (tipo, extra) => {
    onAccion(tipo, extra);
    onCerrar();
  };

  return (
    <div className="mv-panel-fondo" onClick={onCerrar}>
      <div className="mv-panel-acciones" onClick={(e) => e.stopPropagation()}>
        <div className="mv-panel-acciones-header">
          <button type="button" className="mv-panel-cerrar" onClick={onCerrar} title="Cerrar">✕</button>
          <div className="mv-panel-titulo-wrap">
            {equipoLogoUrl && <img className="mv-panel-logo" src={equipoLogoUrl} alt="" />}
            <p className="mv-panel-titulo">Acciones {equipoNombre}</p>
            {jugadorSeleccionado ? (
              <p className="mv-prompt valido">#{jugadorSeleccionado.dorsal ?? '-'} {jugadorSeleccionado.nombre}</p>
            ) : equipoActivoTieneRoster ? (
              <p className="mv-prompt invalido">Seleccioná un jugador en cancha</p>
            ) : null}
          </div>
        </div>

        {jugadorSeleccionado && <FaltasCorregibles {...faltasProps} />}

        <p className="mv-seccion-titulo">Acciones de tiro</p>
        <div className="fiba-botones-grid">
          <button className="btn-fiba tiro" disabled={deshabilitado} onClick={() => disparar('TIRO_LIBRE')}>Tiro Libre</button>
          <button className="btn-fiba tiro" disabled={deshabilitado} onClick={() => disparar('PUNTO', { puntos: 2 })}>+2 PTS</button>
          <button className="btn-fiba tiro" disabled={deshabilitado} onClick={() => disparar('PUNTO', { puntos: 3 })}>+3 PTS</button>
        </div>

        <p className="mv-seccion-titulo">Acciones de juego</p>
        <div className="fiba-botones-grid">
          <button className="btn-fiba juego" disabled={deshabilitado} onClick={() => disparar('REBOTE')}>REB</button>
          <button className="btn-fiba juego" disabled={deshabilitado} onClick={() => disparar('ASISTENCIA')}>AST</button>
          <button className="btn-fiba juego" disabled={deshabilitado} onClick={() => disparar('ROBO')}>ROBO</button>
          <button className="btn-fiba juego" disabled={deshabilitado} onClick={() => disparar('PERDIDA')}>PÉRDIDA</button>
        </div>

        <p className="mv-seccion-titulo">Acciones de falta</p>
        <div className="fiba-botones-grid">
          {TIPOS_FALTA.map((t) => (
            <button
              key={t.id}
              className="btn-fiba falta"
              disabled={t.sinJugador ? false : deshabilitado}
              onClick={() => disparar('FALTA', { tipoFalta: t.id, sinJugador: t.sinJugador })}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        <button className="mv-btn-cambio" disabled={!jugadorSeleccionado} onClick={() => disparar('CAMBIO')}>⇄ Cambio</button>

        {/* Aviso de "hay más para abajo" — con los botones más cuadrados
            (ver .btn-fiba) el contenido no siempre entra sin scrollear, y el
            vidrio esmerilado del panel se confunde con el fondo detrás
            cuando el corte queda justo en el borde. position:sticky hace
            que solo se vea mientras falte contenido por scrollear — al
            llegar al final se funde sola, sin JS. */}
        <div className="mv-panel-fade" aria-hidden="true" />
      </div>
    </div>
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
  // "Entretiempo": null o { texto, equipo: null }. Mismo criterio que
  // marcadorOculto (control en vivo, no se guarda en la base) — mientras
  // esté activo, la escena pública tapa el marcador y muestra un cartel de
  // su mismo tamaño (ver AlertaMarcador.jsx). Solo rastrea Entretiempo acá
  // (para el estado "activo" de su propio botón) — "Minuto solicitado" es
  // un disparo de una sola vez, se apaga solo, no necesita este estado (ver
  // solicitarTimeout más abajo).
  const [alertaMarcador, setAlertaMarcador] = useState(null);
  const [mostrarGestionEscenas, setMostrarGestionEscenas] = useState(false);
  const [escenas, setEscenas] = useState([]);
  const [disenos, setDisenos] = useState([]);
  const [equipoActivo, setEquipoActivo] = useState('local');
  const [jugadorSeleccionadoId, setJugadorSeleccionadoId] = useState(null);
  // El panel de acciones (Tiro Libre/+2/+3/REB/AST/ROBO/PÉRDIDA/FALTA/Cambio)
  // ya no vive fijo en el centro — aparece flotante recién al elegir un
  // jugador en cancha (ver jugadorSeleccionadoId) o, en juego rápido sin
  // plantel, al tocar "Acciones Local/Visita" (ver elegirEquipoActivo). Este
  // estado solo hace falta para ESE segundo caso — con plantel, alcanza con
  // `jugadorSeleccionadoId` (ver `mostrarPanelAcciones` más abajo).
  const [panelAccionesAbierto, setPanelAccionesAbierto] = useState(false);
  const [copiadoFooter, setCopiadoFooter] = useState(null);
  const [editandoPuntos, setEditandoPuntos] = useState(null);
  const [valorPuntosEdit, setValorPuntosEdit] = useState('');
  const [editandoFaltas, setEditandoFaltas] = useState(false);
  const [valorFaltasEdit, setValorFaltasEdit] = useState('');
  // Edición manual del reloj (minutos:segundos) — antes solo se podía
  // sumar/restar de a 1:00 completo con los botones +1:00/-1:00, sin forma
  // de dejarlo en un valor exacto (p. ej. "quedaban 3:27" al reanudar tras
  // una revisión de jugada).
  const [editandoReloj, setEditandoReloj] = useState(false);
  const [minutosRelojEdit, setMinutosRelojEdit] = useState('');
  const [segundosRelojEdit, setSegundosRelojEdit] = useState('');
  // null | 'local' | 'visita' — cuál equipo tiene abierta la ventana
  // flotante de nómina/quinteto (una por vez, se puede volver a abrir
  // cuando haga falta, p. ej. al empezar cada cuarto).
  const [modalNomina, setModalNomina] = useState(null);
  const [modalQuinteto, setModalQuinteto] = useState(null);
  const [modalConvocados, setModalConvocados] = useState(null);
  // Lista de equipos guardados, para "Copiar la nómina de" dentro del popup
  // de "+ Nómina" (ver más abajo) — se pide recién al abrir ese popup, no
  // hace falta antes.
  const [equiposGuardados, setEquiposGuardados] = useState([]);
  const [copiandoNominaMesa, setCopiandoNominaMesa] = useState(false);
  // Ventana de "Elegir/crear equipo guardado" (buscador por nombre/rama/
  // categoría) dentro de "+ Nómina" — boolean nomás, ya sabemos para qué
  // lado es por `modalNomina` (esta ventana solo se puede abrir con la de
  // nómina ya abierta).
  const [modalElegirEquipo, setModalElegirEquipo] = useState(false);
  const [detalleJugadores, setDetalleJugadores] = useState(false);
  // Al disparar Nómina/Estadísticas: si se tapa el marcador base mientras
  // esa capa está en pantalla, o se lo deja visible debajo (por defecto).
  const [ocultarMarcador, setOcultarMarcador] = useState(false);
  // Presentación uno por uno del plantel titular (ver presentarJugador más
  // abajo) — `equipo` es cuál lado se está presentando ahora, `ids` la
  // lista acumulada de ya presentados para ESE equipo (se reinicia sola al
  // cambiar de equipo, o a mano con "Reiniciar presentación").
  const [presentacion, setPresentacion] = useState({ equipo: null, ids: [] });
  const [mostrarPresentacion, setMostrarPresentacion] = useState(false);
  // Qué plantel se está MIRANDO en el panel — independiente de
  // `presentacion.equipo` (lo que ya se mandó a la transmisión), para
  // poder pasar a mirar el otro plantel sin perder/reiniciar la
  // presentación en curso hasta que de verdad se toque a alguien de ahí.
  const [equipoPresentVista, setEquipoPresentVista] = useState('local');
  // null = todavía no se sabe; 0+ = cuántas fuentes (OBS u otro navegador)
  // están mirando el enlace del marcador ahora mismo.
  const [viewersMarcador, setViewersMarcador] = useState(null);
  const socketRef = useRef(null);
  const mesaEnVivoRef = useRef(null);
  const escenaMarcadorTokenRef = useRef(null);
  // A qué equipo apunta CADA lado ahora mismo — hace falta como ref (no
  // alcanza con leer `partido` en el closure de los listeners de abajo,
  // armados una sola vez al montar) para dos cosas: 1) saber cuándo
  // "Reiniciar Partido" cambió de equipo (ver el 'estado' de abajo) y
  // recién ahí volver a pedir la nómina completa del equipo NUEVO —  antes
  // el roster mostrado quedaba con el plantel del equipo VIEJO mezclado con
  // lo que se agregara después; 2) que 'roster_actualizado' (ver
  // avisarRosterActualizado en el backend) siga comparando contra el
  // equipo correcto después de ese cambio, no contra el que había al abrir
  // la Mesa.
  const equipoLocalIdRef = useRef(null);
  const equipoVisitaIdRef = useRef(null);

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

  // "Entretiempo": estado del PARTIDO (no de un equipo puntual), sin
  // duración propia — queda prendido hasta que se vuelva a tocar el botón
  // (toggle). Si ya está mostrando ESTE mismo cartel, lo apaga.
  const dispararAlertaMarcador = (texto) => {
    const mismaAlerta = alertaMarcador?.texto === texto && !alertaMarcador?.equipo;
    const nueva = mismaAlerta ? null : { texto, equipo: null };
    setAlertaMarcador(nueva);
    emitirAccion('MARCADOR_ALERTA', { texto: nueva?.texto || null, equipo: null });
  };

  // "Minuto solicitado" ES el tiempo muerto que cada equipo pide desde la
  // banca — no un cartel aparte: tocar el botón de tiempo muerto (BotonTimeout,
  // que ya venía descontando de timeoutsLocal/Visita) ahora TAMBIÉN dispara
  // el cartel en la transmisión, con la MISMA duración que un aviso de
  // Anuncios (autoOcultar) — se apaga solo, no hace falta volver a tocar nada.
  const solicitarTimeout = (equipo) => {
    emitirAccion('TIMEOUT', { equipo });
    emitirAccion('MARCADOR_ALERTA', { texto: 'MINUTO SOLICITADO', equipo, autoOcultar: true });
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
      equipoLocalIdRef.current = d.partido.equipoLocal.id;
      equipoVisitaIdRef.current = d.partido.equipoVisita.id;
      cargarEscenas();

      const socket = crearSocket();
      socketRef.current = socket;
      socket.on('connect', () => socket.emit('unirse_mesa', { publicToken: d.partido.publicToken }));
      socket.on('estado', (estado) => {
        setPartido(estado);
        // Reabrir "Juego en vivo" con un rival distinto (ver POST /partidos)
        // pudo haber cambiado a QUÉ equipo apunta este lado — el roster ya
        // cargado es del equipo VIEJO, así que hay que pedir de nuevo,
        // entero, el del equipo NUEVO. El botón "↺ Reiniciar Partido" de
        // acá mismo NUNCA cambia de equipo, así que no dispara esto.
        if (estado.equipoLocal.id !== equipoLocalIdRef.current) {
          equipoLocalIdRef.current = estado.equipoLocal.id;
          api.listarJugadores(estado.equipoLocal.id).then((r) => activo && setRosterLocalCompleto(r.jugadores));
        }
        if (estado.equipoVisita.id !== equipoVisitaIdRef.current) {
          equipoVisitaIdRef.current = estado.equipoVisita.id;
          api.listarJugadores(estado.equipoVisita.id).then((r) => activo && setRosterVisitaCompleto(r.jugadores));
        }
      });
      // El plantel de un equipo se puede tocar desde OTRO lado (la página
      // "Equipos", en otra pestaña) mientras esta Mesa sigue abierta — sin
      // esto, un jugador agregado/editado/borrado ahí no aparecía acá hasta
      // recargar la página entera (rosterLocalCompleto/Visita solo se
      // pedían una vez, al entrar). Compara contra los refs (no contra
      // `d.partido`, que quedó fijo en el momento de montar) para seguir
      // funcionando bien después de un cambio de equipo por reinicio.
      socket.on('roster_actualizado', ({ equipoId, jugadores }) => {
        if (equipoId === equipoLocalIdRef.current) setRosterLocalCompleto(jugadores);
        else if (equipoId === equipoVisitaIdRef.current) setRosterVisitaCompleto(jugadores);
      });
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
  // Pulso breve cada vez que cambia el marcador (anotó, o se corrigió a
  // mano) — antes el número solo cambiaba "seco", sin ninguna señal visual
  // de que algo acababa de pasar.
  const destacarPtsLocal = useDestaque(partido?.ptsLocal, 500);
  const destacarPtsVisita = useDestaque(partido?.ptsVisita, 500);

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

  const empezarCorreccionFaltas = (jugador) => {
    setEditandoFaltas(true);
    setValorFaltasEdit(String(jugador.faltasPersonales));
  };
  const confirmarCorreccionFaltas = (equipoKey, jugadorId) => {
    const faltas = Number(valorFaltasEdit);
    if (Number.isInteger(faltas) && faltas >= 0) {
      emitirAccion('FALTAS_CORREGIR', { equipo: equipoKey, jugadorId, faltas });
    }
    setEditandoFaltas(false);
  };
  const cancelarCorreccionFaltas = () => setEditandoFaltas(false);

  const empezarEdicionReloj = () => {
    const totalActual = partido.relojSegundos;
    setMinutosRelojEdit(String(Math.floor(totalActual / 60)));
    setSegundosRelojEdit(String(totalActual % 60).padStart(2, '0'));
    setEditandoReloj(true);
  };
  const confirmarEdicionReloj = () => {
    const minutos = Math.max(0, Number(minutosRelojEdit) || 0);
    const segundos = Math.max(0, Math.min(59, Number(segundosRelojEdit) || 0));
    emitirAccion('RELOJ_FIJAR', { segundos: minutos * 60 + segundos });
    setEditandoReloj(false);
  };
  const cancelarEdicionReloj = () => setEditandoReloj(false);

  // Vuelve el marcador/faltas/reloj/estadísticas a cero SIN crear un partido
  // nuevo — el enlace de transmisión (mismo public_token) no cambia, así que
  // sirve para arrancar otro juego reusando el mismo enlace ya cargado en OBS.
  // Los EQUIPOS (Local/Visita) siempre siguen siendo los mismos — lo único
  // que cambia es que la nómina de ambos queda vacía, lista para cargar de
  // nuevo con "+ Nómina" (copiando de un equipo guardado, o a mano). Antes
  // esto abría un modal a elegir, por lado, entre mantener nómina/equipo
  // existente/equipo nuevo — la nómina se perdía igual salvo que se
  // marcara "mantener", así que en la práctica esa elección de más solo
  // agregaba pasos para algo que hoy es siempre el mismo resultado.
  const reiniciarPartido = () => {
    if (!window.confirm('¿Reiniciar el partido? Vuelve el marcador, faltas, reloj y estadísticas a cero, y deja la nómina de ambos equipos vacía para cargarla de nuevo. El enlace de transmisión no cambia.')) return;
    emitirAccion('PARTIDO_REINICIAR');
    setJugadas([]);
  };

  const abrirNomina = (equipoKey) => {
    setModalNomina(equipoKey);
    api.listarEquipos().then((d) => setEquiposGuardados(d.equipos)).catch(() => setEquiposGuardados([]));
  };

  // "Copiar la nómina de" dentro de "+ Nómina" (ver ModalRoster más abajo)
  // — mismo mecanismo que ya usa "Personalizar tablero → Equipos"
  // (copiarNominaDesde en EquipoFicha.jsx): el backend REEMPLAZA la nómina
  // actual de este equipo por la del origen elegido (protegiendo jugadores
  // con jugadas ya registradas), así que acá también se reemplaza el
  // estado entero en vez de sumarlo. Si alguien que estaba en cancha ya no
  // forma parte de la nómina nueva, sale también del quinteto (mismo
  // criterio que eliminarJugadorDeRoster).
  const copiarNominaEnMesa = async (equipoKey, origenIdTexto) => {
    const origenId = Number(origenIdTexto);
    if (!origenId) return;
    const equipoDestino = equipoKey === 'local' ? partido.equipoLocal : partido.equipoVisita;
    setCopiandoNominaMesa(true);
    setError('');
    try {
      const { jugadores } = await api.copiarNomina(equipoDestino.id, origenId);
      (equipoKey === 'local' ? setRosterLocalCompleto : setRosterVisitaCompleto)(jugadores);
      const idsNuevos = new Set(jugadores.map((j) => j.id));
      const quinteto = equipoKey === 'local' ? partido.quintetoLocalIds : partido.quintetoVisitaIds;
      const quintetoFiltrado = quinteto.filter((id) => idsNuevos.has(id));
      if (quintetoFiltrado.length !== quinteto.length) cambiarQuinteto(equipoKey, quintetoFiltrado);
    } catch (err) {
      setError(err.message);
    } finally {
      setCopiandoNominaMesa(false);
    }
  };

  // "Vaciar nómina de este partido" — saca a todo el plantel de ESTE
  // equipo (protegiendo a quien ya tenga jugadas registradas), sin tocar
  // el plantel guardado de ningún otro equipo en "Equipos". Mismo criterio
  // de quinteto que copiarNominaEnMesa: si alguien que estaba en cancha ya
  // no forma parte de la nómina, sale también del quinteto.
  const vaciarNominaEnMesa = async (equipoKey) => {
    const equipo = equipoKey === 'local' ? partido.equipoLocal : partido.equipoVisita;
    if (!window.confirm(`¿Vaciar la nómina de ${equipo.nombre} para este partido? No se borra el plantel guardado en "Equipos" — solo se saca de este partido. A quien ya tenga jugadas anotadas no se lo puede sacar.`)) return;
    setError('');
    try {
      const { jugadores } = await api.vaciarNomina(equipo.id);
      (equipoKey === 'local' ? setRosterLocalCompleto : setRosterVisitaCompleto)(jugadores);
      const idsNuevos = new Set(jugadores.map((j) => j.id));
      const quinteto = equipoKey === 'local' ? partido.quintetoLocalIds : partido.quintetoVisitaIds;
      const quintetoFiltrado = quinteto.filter((id) => idsNuevos.has(id));
      if (quintetoFiltrado.length !== quinteto.length) cambiarQuinteto(equipoKey, quintetoFiltrado);
    } catch (err) {
      setError(err.message);
    }
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

  // Si hay convocados armados para este equipo (Mesa → "Elegir
  // convocados"), el roster que se usa para JUGAR (banca/cancha/anotar) se
  // achica a esa lista — el plantel completo (rosterLocalCompleto/
  // rosterVisitaCompleto) sigue intacto, solo se usa acá para saber a quién
  // mostrar. Sin convocatoria armada (array vacío, el default), juega el
  // plantel completo, igual que siempre.
  const rosterConStats = (equipoKey) => {
    const rosterCompleto = equipoKey === 'local' ? rosterLocalCompleto : rosterVisitaCompleto;
    const rosterStats = equipoKey === 'local' ? partido.equipoLocal.roster : partido.equipoVisita.roster;
    const convocados = equipoKey === 'local' ? partido.convocadosLocalIds : partido.convocadosVisitaIds;
    const statsPorId = new Map(rosterStats.map((j) => [j.id, j]));
    const base = convocados?.length ? rosterCompleto.filter((j) => convocados.includes(j.id)) : rosterCompleto;
    return base.map((j) => ({ ...j, ...(statsPorId.get(j.id) || {}) }));
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

  // Convocados: quiénes del plantel guardado juegan HOY (máx. 12 sugerido,
  // se puede "elegir igual" con más si hace falta) — no toca el plantel
  // real del equipo, solo filtra a quién se ve en banca/cancha/anotar (ver
  // rosterConStats). Vacío = sin convocatoria armada, juega el plantel
  // completo — "dejar a todos" es simplemente no tocar esto.
  const cambiarConvocados = (equipoKey, ids) => {
    const quintetoActual = equipoKey === 'local' ? partido.quintetoLocalIds : partido.quintetoVisitaIds;
    if (ids.length > 0 && quintetoActual.some((id) => !ids.includes(id))) {
      cambiarQuinteto(equipoKey, quintetoActual.filter((id) => ids.includes(id)));
    }
    emitirAccion('CONVOCADOS_ACTUALIZAR', { equipo: equipoKey, ids });
  };

  // Sacar un jugador de la nómina desde la Mesa (partido ya en curso) — si
  // estaba en cancha en ese momento, sale también del quinteto (si no,
  // quedaba un id fantasma jugando un partido sin existir más en la
  // nómina).
  const eliminarJugadorDeRoster = (equipoKey, jugadorId) => {
    (equipoKey === 'local' ? setRosterLocalCompleto : setRosterVisitaCompleto)((r) => r.filter((j) => j.id !== jugadorId));
    const quinteto = equipoKey === 'local' ? partido.quintetoLocalIds : partido.quintetoVisitaIds;
    if (quinteto.includes(jugadorId)) cambiarQuinteto(equipoKey, quinteto.filter((id) => id !== jugadorId));
  };

  // En juego rápido (sin plantel), tocar "Acciones Local/Visita" es lo que
  // abre el panel flotante — no hay un dorsal que tocar para eso (ver
  // mostrarPanelAcciones más abajo).
  const elegirEquipoActivo = (equipoKey) => {
    setEquipoActivo(equipoKey);
    setJugadorSeleccionadoId(null);
    setPanelAccionesAbierto(true);
  };

  const cerrarPanelAcciones = () => {
    setPanelAccionesAbierto(false);
    setJugadorSeleccionadoId(null);
    setEditandoFaltas(false);
  };

  // Tocar cualquier jugador/a en cancha (sea local o visita) habilita
  // automáticamente las acciones de SU equipo — ya no hace falta tocar
  // primero "Acciones Local"/"Acciones Visita" para que el botón responda.
  // Volver a tocar el mismo dorsal ya elegido lo deselecciona y con eso
  // cierra el panel flotante de acciones (ver mostrarPanelAcciones).
  const elegirJugador = (equipoKey, jugadorId) => {
    if (equipoActivo === equipoKey && jugadorSeleccionadoId === jugadorId) {
      setJugadorSeleccionadoId(null);
      setEditandoFaltas(false);
    } else {
      setEquipoActivo(equipoKey);
      setJugadorSeleccionadoId(jugadorId);
      setEditandoFaltas(false);
    }
  };

  const jugadorSeleccionado = enCanchaDelEquipo(equipoActivo).find((j) => j.id === jugadorSeleccionadoId) || null;

  // Juego rápido: si el equipo activo no tiene plantel cargado, las acciones
  // se registran a nivel de equipo (jugadorId null) — no hace sentido exigir
  // elegir un jugador que no existe. Con plantel, se sigue pidiendo elegirlo
  // (así se mantienen las estadísticas por jugador).
  const equipoActivoTieneRoster = (equipoActivo === 'local' ? rosterLocalCompleto : rosterVisitaCompleto).length > 0;

  // El panel flotante de acciones se muestra al elegir un jugador en cancha
  // (con plantel) o, en juego rápido sin plantel, recién al tocar
  // "Acciones Local/Visita" (ver elegirEquipoActivo/panelAccionesAbierto) —
  // antes este bloque quedaba siempre fijo en pantalla, ocupando lugar aunque
  // no hubiera nada elegido.
  const mostrarPanelAcciones = jugadorSeleccionadoId != null || (!equipoActivoTieneRoster && panelAccionesAbierto);

  const manejarAccion = (tipo, extra = {}) => {
    if (equipoActivoTieneRoster && !jugadorSeleccionadoId) return;
    if (tipo === 'CAMBIO') {
      if (!jugadorSeleccionadoId) return; // el cambio sí necesita un jugador puntual que sale
      setAccionPendiente({ tipo, equipo: equipoActivo, jugadorId: jugadorSeleccionadoId });
      return;
    }
    if (tipo === 'TIRO_LIBRE') {
      setAccionPendiente({ tipo, equipo: equipoActivo, jugadorId: jugadorSeleccionadoId || null });
      return;
    }
    // FALTA ya no abre un modal aparte (ver PanelAcciones: el tipo de falta
    // se elige ahí mismo, debajo de la grilla principal) — llega acá con
    // `extra.tipoFalta` ya puesto, así que se emite directo como cualquier
    // otra acción. "Técnica banco/DT" (extra.sinJugador) siempre manda
    // jugadorId null — no es de nadie en cancha, así que no puede quedar
    // pegada al jugador que casualmente estuviera seleccionado.
    const { sinJugador, ...datosAccion } = extra;
    emitirAccion(tipo, { equipo: equipoActivo, jugadorId: sinJugador ? null : (jugadorSeleccionadoId || null), ...datosAccion });
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

  // El lector de reloj por cámara está pensado para abrirse en OTRO celular
  // (alguien apunta esa cámara al reloj físico de la cancha mientras vos
  // seguís con marcador/estadísticas acá) — copiar el enlace es más útil
  // que un link para abrir en la misma pestaña, ya que hay que mandárselo a
  // ese otro dispositivo (WhatsApp, etc.). Enlace FIJO por usuario (sin el
  // id de este partido en la URL) — se resuelve solo al partido en curso más
  // reciente de la cuenta (ver GET /partidos/activo), así sirve igual para
  // cualquier otro marcador que se arranque después, sin copiar uno nuevo
  // cada vez. El segundo celular igual necesita estar logueado con la misma
  // cuenta (la ruta va protegida, como el resto de la Mesa).
  const copiarLinkLectorReloj = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/mesa/reloj-camara`);
    setCopiadoFooter('reloj-camara');
    setTimeout(() => setCopiadoFooter(null), 2000);
  };

  const escenaMarcadorActual = escenas.find((e) => e.tipo === 'marcador');

  const reproducirNomina = (modo) => emitirAccion('NOMINA_REPRODUCIR', { modo, ocultarMarcador });
  const dispararEstadisticas = (payload) => emitirAccion('ESTADISTICAS_MOSTRAR', { ...payload, ocultarMarcador });
  // Presentación del plantel titular, uno por uno: cada toque en un jugador
  // manda la lista COMPLETA de presentados hasta ahora (el backend no
  // guarda ningún estado propio, solo reenvía — ver el comentario en
  // socket/index.js). Cambiar de equipo arranca una lista nueva; volver a
  // tocar un jugador ya presentado lo manda de nuevo al frente (repite su
  // momento grande), coherente con lo que se ve en pantalla.
  const presentarJugador = (jugadorId) => {
    const equipo = equipoPresentVista;
    const ids = presentacion.equipo === equipo
      ? [...presentacion.ids.filter((id) => id !== jugadorId), jugadorId]
      : [jugadorId];
    setPresentacion({ equipo, ids });
    emitirAccion('NOMINA_REPRODUCIR', { modo: 'presentacion', equipo, jugadorIds: ids, ocultarMarcador });
  };
  const reiniciarPresentacion = () => setPresentacion({ equipo: null, ids: [] });
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
            {!embebido && <Link className="mv-pill" to={`/mesa/${id}/simple`}>📋 Mesa simple</Link>}
            {/* A diferencia de "Mesa simple" (navega a otra página, no tiene
                sentido ofrecerlo adentro de "Juego en vivo" embebido), este
                botón solo copia al portapapeles — no saca de la pantalla, así
                que se muestra siempre, embebido o no. Antes quedaba escondido
                acá también, y "Juego en vivo" (el lugar donde de verdad se
                arma cada partido) es justo donde más falta hace. */}
            <button className="mv-pill" onClick={copiarLinkLectorReloj} title="Enlace fijo para tu cuenta — abrilo en otro celular para leer el reloj físico con esa cámara. Sirve para cualquier partido que tengas en curso, no hace falta copiar uno nuevo cada vez.">
              {copiadoFooter === 'reloj-camara' ? '✓ Enlace copiado' : '📷 Copiar enlace del lector de reloj'}
            </button>
            <button className="mv-pill" onClick={alternarPantallaCompleta}>
              {enPantallaCompleta ? '✕ Salir de Pantalla Completa' : '⛶ Pantalla Completa'}
            </button>
            <button className={`mv-pill ${!marcadorOculto ? 'activa' : 'mv-pill-alerta'}`} onClick={alternarVisibilidadMarcador}>
              {marcadorOculto ? '🚫 Marcador Oculto' : '🟢 Marcador Visible'}
            </button>
            <button
              className={`mv-pill ${alertaMarcador?.texto === 'ENTRETIEMPO' ? 'mv-pill-alerta' : ''}`}
              title="Oculta el marcador y muestra un cartel de ENTRETIEMPO del mismo tamaño, hasta volver a tocar el botón"
              onClick={() => dispararAlertaMarcador('ENTRETIEMPO')}
            >
              {alertaMarcador?.texto === 'ENTRETIEMPO' ? '🚫 Quitar Entretiempo' : '⏸ Entretiempo'}
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
            <button className="mv-pill" title="Vuelve el marcador a 0-0 para empezar otro partido — el enlace de OBS no cambia" onClick={reiniciarPartido}>↺ Reiniciar Partido</button>
            <button className="mv-pill mv-pill-peligro" title="El enlace de OBS sigue funcionando después de finalizar" onClick={finalizarPartido}>⏹ Finalizar Partido</button>
          </div>

          <div className="mv-disparadores mv-disparadores-compacto">
            <div className="fila-form">
              <span className="mv-disparadores-etiqueta" title="Nómina">👥</span>
              <button className="mv-pill mv-pill-chico" title="Mostrar nómina — Local" onClick={() => reproducirNomina('local')}>Local</button>
              <button className="mv-pill mv-pill-chico" title="Mostrar nómina — Visita" onClick={() => reproducirNomina('visita')}>Visita</button>
              <button className="mv-pill mv-pill-chico" title="Mostrar nómina — Ambos" onClick={() => reproducirNomina('ambos')}>Ambos</button>
              <button
                className={`mv-pill mv-pill-chico ${mostrarPresentacion ? 'activo' : ''}`}
                title="Presentar el plantel titular uno por uno, con foto y nombre"
                onClick={() => setMostrarPresentacion((v) => !v)}
              >
                🎬 Presentar
              </button>
              <span className="mv-disparadores-sep" />
              <span className="mv-disparadores-etiqueta" title="Estadísticas">📊</span>
              <button className="mv-pill mv-pill-chico" title="Estadísticas — Equipo Local" onClick={() => dispararEstadisticas({ modo: 'equipo', equipo: 'local', detalle: detalleJugadores })}>Local</button>
              <button className="mv-pill mv-pill-chico" title="Estadísticas — Equipo Visita" onClick={() => dispararEstadisticas({ modo: 'equipo', equipo: 'visita', detalle: detalleJugadores })}>Visita</button>
              <button className="mv-pill mv-pill-chico" title="Estadísticas — Ambos Equipos" onClick={() => dispararEstadisticas({ modo: 'ambos', detalle: detalleJugadores })}>Ambos</button>
              <select
                className="mv-select mv-select-chico"
                title="Estadísticas de un jugador puntual"
                value=""
                onChange={(ev) => { if (ev.target.value) dispararEstadisticas({ modo: 'jugador', jugadorId: Number(ev.target.value) }); }}
              >
                <option value="">Jugador…</option>
                {jugadoresDeAmbos.map((j) => (
                  <option key={j.id} value={j.id}>{j.equipoNombre} — #{j.dorsal ?? '-'} {j.nombre}</option>
                ))}
              </select>
              <span className="mv-disparadores-sep" />
              <label className="mv-check-detalle" title="Incluir detalle por jugador en Equipo Local/Visita/Ambos">
                <input type="checkbox" checked={detalleJugadores} onChange={(e) => setDetalleJugadores(e.target.checked)} />
                Detalle x jugador
              </label>
              <label className="mv-check-detalle" title="Ocultar el marcador mientras se muestra Nómina/Estadísticas">
                <input type="checkbox" checked={ocultarMarcador} onChange={(e) => setOcultarMarcador(e.target.checked)} />
                Ocultar marcador
              </label>
            </div>
          </div>

          {mostrarPresentacion && (
            <div className="mv-presentacion-panel">
              <div className="mv-acciones-segmentado" style={{ marginBottom: 8 }}>
                <button className={`mv-acciones-segmento ${equipoPresentVista === 'local' ? 'activo' : ''}`} onClick={() => setEquipoPresentVista('local')}>
                  {partido.equipoLocal.nombre}
                </button>
                <button className={`mv-acciones-segmento ${equipoPresentVista === 'visita' ? 'activo' : ''}`} onClick={() => setEquipoPresentVista('visita')}>
                  {partido.equipoVisita.nombre}
                </button>
              </div>
              <p className="mv-texto-tenue" style={{ margin: '0 0 8px' }}>
                Tocá cada jugador/a en el orden en que se va a presentar — entra con foto y nombre en pantalla grande y
                después queda en la lista acumulada. Volver a tocar a alguien repite su momento.
              </p>
              <div className="mv-banco-grid">
                {(equipoPresentVista === 'local' ? partido.equipoLocal.roster : partido.equipoVisita.roster).map((j) => (
                  <BotonDorsal
                    key={j.id}
                    jugador={j}
                    color={equipoPresentVista === 'local' ? partido.equipoLocal.color : partido.equipoVisita.color}
                    variante="banco"
                    interactivo
                    seleccionado={presentacion.equipo === equipoPresentVista && presentacion.ids.includes(j.id)}
                    onClick={() => presentarJugador(j.id)}
                  />
                ))}
              </div>
              {presentacion.ids.length > 0 && (
                <button type="button" className="mv-pill" style={{ marginTop: 8 }} onClick={reiniciarPresentacion}>
                  🔄 Reiniciar presentación
                </button>
              )}
            </div>
          )}

          {jugadoresDescalificadosEnCancha.length > 0 && (
            <div className="mensaje-error" style={{ marginBottom: 12 }}>
              Sustitución obligatoria: {jugadoresDescalificadosEnCancha.map((j) => `#${j.dorsal ?? '-'} ${j.nombre} (${j.equipo})`).join(', ')}
            </div>
          )}

          {/* Barra de marcador: los puntajes quedan siempre pegados al reloj
              central (a la derecha en Local, a la izquierda en Visita),
              nombre/logo hacia el borde exterior de la pantalla. Las "F"
              que se ven acá (y en el marcador real, todas las plantillas)
              son faltasPeriodoLocal/Visita — las del PERÍODO actual (se
              reinician solas en cada cuarto/prórroga, ver fijarPeriodo en
              el backend), no el total del partido — es lo que de verdad
              importa para saber cuándo el rival entra en bonus. El total
              del partido completo (faltasLocal/Visita) sigue existiendo
              en el estado por si hace falta en otro lado, pero ya no se
              muestra como el contador de "F" en ningún lugar. */}
          <div className="mv-scorebar">
            <div className={`mv-equipo-box ${destacarTimeoutLocal ? 'mv-box-destacado' : ''}`} style={{ border: `1px solid ${partido.equipoLocal.color}88`, background: `${partido.equipoLocal.color}14` }}>
              <div className="mv-equipo-fila">
                <BotonTimeout restantes={partido.timeoutsLocal} destacado={destacarTimeoutLocal} onClick={() => solicitarTimeout('local')} />
                {partido.equipoLocal.logo_url && <img className="mv-equipo-logo" src={partido.equipoLocal.logo_url} alt="" />}
                <div className="mv-equipo-nombres">
                  <span className="mv-equipo-etiqueta" style={{ color: partido.equipoLocal.color }}>LOCAL {partido.posesion === 'local' && '◀'}</span>
                  <span className="mv-equipo-nombre">{partido.equipoLocal.nombre}</span>
                </div>
                <PuntosCorregibles
                  valor={partido.ptsLocal}
                  destacado={destacarPtsLocal}
                  editando={editandoPuntos === 'local'}
                  valorEdit={valorPuntosEdit}
                  onEmpezar={() => empezarCorreccionPuntos('local')}
                  onCambiarValor={setValorPuntosEdit}
                  onConfirmar={confirmarCorreccionPuntos}
                  onCancelar={cancelarCorreccionPuntos}
                />
              </div>
              <div className="mv-equipo-pie">
                <span className="mv-faltas">F: {partido.faltasPeriodoLocal}</span>
              </div>
            </div>

            <div className="mv-centro">
              <span className="mv-chip-competicion">Partido en curso</span>
              {/* Solo lectura acá — el control de verdad (editar a mano,
                  subir/bajar rápido) vive debajo de "Control de Partido",
                  más grande y pensado para el dedo, no para leer de reojo. */}
              <span className={`mv-reloj-lectura ${partido.relojCorriendo ? 'corriendo' : ''}`}>
                {formatearReloj(partido.relojSegundos)}
              </span>
              <h4 className="mv-periodo-label">{etiquetaPeriodo(partido.periodo)}</h4>
              <button className="mv-btn-posesion" onClick={() => emitirAccion('POSESION_TOGGLE')} title="Cambiar posesión">⇄</button>
            </div>

            <div className={`mv-equipo-box visita ${destacarTimeoutVisita ? 'mv-box-destacado' : ''}`} style={{ border: `1px solid ${partido.equipoVisita.color}88`, background: `${partido.equipoVisita.color}14` }}>
              <div className="mv-equipo-fila">
                <PuntosCorregibles
                  valor={partido.ptsVisita}
                  destacado={destacarPtsVisita}
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
                <BotonTimeout restantes={partido.timeoutsVisita} destacado={destacarTimeoutVisita} onClick={() => solicitarTimeout('visita')} />
              </div>
              <div className="mv-equipo-pie">
                <span className="mv-faltas">F: {partido.faltasPeriodoVisita}</span>
              </div>
            </div>
          </div>

          <div className="mv-layout-grid">
            <div className="mv-zona mv-zona-local">
              <div className="mv-zona-titulo-fila">
                <p className="mv-zona-titulo">Roster Local ({rosterLocalCompleto.length}/12)</p>
                <button type="button" className="mv-btn-nomina" onClick={() => setModalConvocados('local')}>
                  🎽 {partido.convocadosLocalIds?.length ? `Convocados (${partido.convocadosLocalIds.length})` : 'Convocados: todos'}
                </button>
                <button type="button" className="mv-btn-nomina" onClick={() => abrirNomina('local')}>+ Nómina</button>
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
                <select
                  className="mv-select mv-select-periodo-grande"
                  value={partido.periodo}
                  onChange={(e) => emitirAccion('PERIODO_FIJAR', { periodo: Number(e.target.value) })}
                  title="Elegir el cuarto/prórroga que se está jugando"
                >
                  {PERIODOS_DISPONIBLES.map((p) => <option key={p} value={p}>{etiquetaPeriodo(p)}</option>)}
                </select>
                {partido.relojCorriendo ? (
                  <button className="mv-btn-electrico mv-btn-electrico-grande" onClick={() => emitirAccion('RELOJ_PAUSAR')}>⏸ Pausar</button>
                ) : (
                  <button className="mv-btn-electrico mv-btn-electrico-grande" onClick={() => emitirAccion('RELOJ_INICIAR')}>▶ Iniciar</button>
                )}
              </div>

              <RuedaReloj
                segundos={partido.relojSegundos}
                corriendo={partido.relojCorriendo}
                editando={editandoReloj}
                minutosEdit={minutosRelojEdit}
                segundosEdit={segundosRelojEdit}
                onCambiarMinutos={setMinutosRelojEdit}
                onCambiarSegundos={setSegundosRelojEdit}
                onEmpezarEdicion={empezarEdicionReloj}
                onConfirmarEdicion={confirmarEdicionReloj}
                onCancelarEdicion={cancelarEdicionReloj}
                onAjustar={(delta) => emitirAccion('RELOJ_AJUSTAR', { segundos: delta })}
                onReiniciar={() => emitirAccion('RELOJ_REINICIAR')}
              />

              {/* Con plantel, tocar cualquier jugador/a ya elige el equipo activo
                  solo (ver elegirJugador) — estos botones quedaban de adorno,
                  sin nada que hacer. Solo hacen falta cuando alguno de los dos
                  equipos juega "rápido" sin plantel: ahí no hay jugador que
                  tocar para activarlo, así que es la única forma de elegirlo. */}
              {(rosterLocalCompleto.length === 0 || rosterVisitaCompleto.length === 0) && (
                <div className="mv-acciones-segmentado">
                  <button className={`mv-acciones-segmento ${equipoActivo === 'local' && panelAccionesAbierto ? 'activo' : ''}`} onClick={() => elegirEquipoActivo('local')}>
                    Acciones Local
                  </button>
                  <button className={`mv-acciones-segmento ${equipoActivo === 'visita' && panelAccionesAbierto ? 'activo' : ''}`} onClick={() => elegirEquipoActivo('visita')}>
                    Acciones Visita
                  </button>
                </div>
              )}
            </div>

            <div className="mv-zona mv-zona-visita">
              <div className="mv-zona-titulo-fila">
                <p className="mv-zona-titulo">Roster Visita ({rosterVisitaCompleto.length}/12)</p>
                <button type="button" className="mv-btn-nomina" onClick={() => setModalConvocados('visita')}>
                  🎽 {partido.convocadosVisitaIds?.length ? `Convocados (${partido.convocadosVisitaIds.length})` : 'Convocados: todos'}
                </button>
                <button type="button" className="mv-btn-nomina" onClick={() => abrirNomina('visita')}>+ Nómina</button>
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

          {mostrarPanelAcciones && (
            <PanelAcciones
              equipoNombre={equipoActivoNombre}
              equipoLogoUrl={equipoActivo === 'local' ? partido.equipoLocal.logo_url : partido.equipoVisita.logo_url}
              jugadorSeleccionado={jugadorSeleccionado}
              equipoActivoTieneRoster={equipoActivoTieneRoster}
              onAccion={manejarAccion}
              onCerrar={cerrarPanelAcciones}
              faltasProps={{
                valor: jugadorSeleccionado?.faltasPersonales,
                editando: editandoFaltas,
                valorEdit: valorFaltasEdit,
                onEmpezar: () => empezarCorreccionFaltas(jugadorSeleccionado),
                onCambiarValor: setValorFaltasEdit,
                onConfirmar: () => confirmarCorreccionFaltas(equipoActivo, jugadorSeleccionado?.id),
                onCancelar: cancelarCorreccionFaltas,
              }}
            />
          )}

        </div>
      )}

      {partido.estado === 'finalizado' && (
        <div className="pagina-centrada">
          <p>Este partido ya finalizó. Marcador final: {partido.ptsLocal} - {partido.ptsVisita}</p>
          <button className="btn-secundario" onClick={reiniciarPartido}>🔄 Reiniciar partido (mismo enlace)</button>
        </div>
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
        <ModalRoster onCerrar={() => { setModalNomina(null); setModalElegirEquipo(false); }}>
          <div className="tarjeta mv-copiar-nomina">
            <div className="fila-form" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn-secundario" disabled={copiandoNominaMesa} onClick={() => setModalElegirEquipo(true)}>
                🔍 Elegir/crear equipo guardado
              </button>
              {(modalNomina === 'local' ? rosterLocalCompleto : rosterVisitaCompleto).length > 0 && (
                <button type="button" className="btn-link" onClick={() => vaciarNominaEnMesa(modalNomina)}>
                  🗑 Vaciar nómina de este partido
                </button>
              )}
            </div>
            <p className="texto-tenue" style={{ margin: '6px 0 0', fontSize: 12 }}>
              Elegir un equipo reemplaza la nómina de abajo por la suya — vaciarla no borra el plantel guardado en "Equipos", solo la saca de este partido.
            </p>
          </div>
          <EquipoRoster
            equipo={modalNomina === 'local' ? partido.equipoLocal : partido.equipoVisita}
            roster={modalNomina === 'local' ? rosterLocalCompleto : rosterVisitaCompleto}
            seleccionable={false}
            onJugadorAgregado={(j) => (modalNomina === 'local' ? setRosterLocalCompleto : setRosterVisitaCompleto)((r) => [...r, j])}
            permitirEliminar
            onJugadorEliminado={(id) => eliminarJugadorDeRoster(modalNomina, id)}
            permitirEditar
            onJugadorEditado={(actualizado) => (modalNomina === 'local' ? setRosterLocalCompleto : setRosterVisitaCompleto)((r) => r.map((x) => (x.id === actualizado.id ? actualizado : x)))}
            partidoId={partido.id}
          />
        </ModalRoster>
      )}

      {modalNomina && modalElegirEquipo && (
        <ModalElegirEquipo
          equipos={equiposGuardados}
          equipoActualId={modalNomina === 'local' ? partido.equipoLocal.id : partido.equipoVisita.id}
          onUsar={(id) => {
            copiarNominaEnMesa(modalNomina, id);
            setModalElegirEquipo(false);
          }}
          onCerrar={() => setModalElegirEquipo(false)}
        />
      )}

      {modalQuinteto && (
        <ModalRoster onCerrar={() => setModalQuinteto(null)}>
          <EquipoRoster
            equipo={modalQuinteto === 'local' ? partido.equipoLocal : partido.equipoVisita}
            roster={rosterConStats(modalQuinteto)}
            seleccionados={modalQuinteto === 'local' ? partido.quintetoLocalIds : partido.quintetoVisitaIds}
            onCambiarQuinteto={(ids) => cambiarQuinteto(modalQuinteto, ids)}
            permitirAgregar={false}
          />
        </ModalRoster>
      )}

      {modalConvocados && (
        <ModalRoster onCerrar={() => setModalConvocados(null)}>
          <EquipoRoster
            equipo={modalConvocados === 'local' ? partido.equipoLocal : partido.equipoVisita}
            roster={modalConvocados === 'local' ? rosterLocalCompleto : rosterVisitaCompleto}
            seleccionados={
              (modalConvocados === 'local' ? partido.convocadosLocalIds : partido.convocadosVisitaIds)?.length
                ? (modalConvocados === 'local' ? partido.convocadosLocalIds : partido.convocadosVisitaIds)
                : (modalConvocados === 'local' ? rosterLocalCompleto : rosterVisitaCompleto).map((j) => j.id)
            }
            onCambiarQuinteto={(ids) => cambiarConvocados(modalConvocados, ids)}
            permitirAgregar={false}
            maxSeleccion={12}
            toqueSuave
            etiquetaSeleccion="convocados"
          />
          <p className="texto-tenue" style={{ margin: '8px 0 0', fontSize: 12 }}>
            Máximo sugerido 12 (norma FIBA) — podés convocar a todo el plantel si hace falta.
          </p>
          <button
            type="button"
            className="btn-link"
            style={{ marginTop: 4 }}
            onClick={() => cambiarConvocados(modalConvocados, [])}
          >
            Dejar a todos convocados
          </button>
        </ModalRoster>
      )}

    </div>
  );
}
