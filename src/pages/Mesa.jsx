import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getToken } from '../api/client';
import { crearSocket } from '../socket';
import { useRelojVivo, useRelojPosesion, formatearPosesion, contrasteTexto, formatearReloj as formatearRelojVivo } from '../marcadores/utils';
import EquipoRoster from '../components/EquipoRoster';
import SelectorNomina from '../components/SelectorNomina';
import TablaEstadisticas from '../components/TablaEstadisticas';
import PanelMarcadorCamara from '../components/PanelMarcadorCamara';
import { hayNominas, lideresPartido, tablaPorPeriodo, tituloIntertanto } from '../marcadores/intertanto';
import { ATAJOS_MESA, sonarBocina, useAtajosMesa } from './mesaAyudas';
import './mesa.css';
import './mesaTipos.css';

// Los 4 tipos de falta del reglamento FIBA vigente (personal/técnica/
// antideportiva/descalificante) + "Técnica banco/DT": no es un tipo FIBA
// nuevo, es la MISMA falta técnica pero cargada al banco/cuerpo técnico en
// vez de a un jugador en cancha — no cuenta para las 5 personales de nadie,
// así que conviene poder cargarla sin tener que "elegir" a algún jugador
// solo para poder anotarla. `sinJugador` hace que, al dispararla, se mande
// siempre jugadorId null sin importar qué jugador esté seleccionado en ese
// momento (ver disparar() en PanelAcciones).
// Tipos de mesa: mismas piezas y funciones, distinto orden y aspecto.
// Paletas de color de la mesa (solo se ven en la Mesa, no salen al aire).
const TEMAS_MESA = [
  { id: 'original', etiqueta: 'Original' },
  { id: 'medianoche', etiqueta: 'Medianoche' },
  { id: 'duela', etiqueta: 'Duela (madera)' },
  { id: 'neon', etiqueta: 'Neón' },
  { id: 'esmeralda', etiqueta: 'Esmeralda' },
  { id: 'carbon', etiqueta: 'Carbón y rojo' },
];
const TIPOS_MESA = [
  { id: 'clasica', etiqueta: 'Clásica' },
  { id: 'consola', etiqueta: 'Consola' },
  { id: 'tablet', etiqueta: 'Tablet' },
  { id: 'jugadora', etiqueta: 'Por jugadora' },
];

const TIPOS_FALTA = [
  { id: 'personal', etiqueta: 'Personal' },
  { id: 'tecnica', etiqueta: 'Técnica' },
  { id: 'tecnica_banco', etiqueta: 'Técnica banco/DT', sinJugador: true },
  { id: 'antideportiva', etiqueta: 'Antideportiva' },
  { id: 'descalificante', etiqueta: 'Descalificante' },
];
// Solo los convertidos (+1/+2/+3): menos opciones, menos errores en vivo.
const COMBOS_TIRO_LIBRE = [1, 2, 3].map((n) => ({ convertidos: n, intentos: n }));

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
        <h3>Tiros libres convertidos</h3>
        <div className="modal-opciones-grid">
          {COMBOS_TIRO_LIBRE.map((c) => (
            <button key={c.convertidos} className="modal-opcion-btn modal-opcion-tl" onClick={() => onElegir(c)}>
              +{c.convertidos}
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
// Mismo grid de botones grandes que "Editar quinteto"/"Convocados" (ver
// .selector-dorsal-grid en EquipoRoster.jsx) en vez de la lista angosta de
// filas de antes — un solo toque entra directo (acá no hace falta un paso
// de "confirmar", a diferencia de quinteto/convocados que sí son multi-
// selección). `modal-caja-cambio` le da el acento ROJO propio de un cambio
// (en vez del azul de siempre de selector-dorsal-btn), para que se lea de
// un vistazo que es un flujo distinto — mismo rojo que ya usan las
// acciones de falta, a propósito: "cambio" también corta el juego.
function ModalCambio({ banca, onElegir, onCerrar, forzado }) {
  const sinBanca = banca.length === 0;
  const sePuedeCerrar = !forzado || sinBanca;
  return (
    <div className="modal-fondo" onClick={sePuedeCerrar ? onCerrar : undefined}>
      <div className="modal-caja modal-caja-cambio" onClick={(e) => e.stopPropagation()}>
        <h3>{forzado ? '⚠ Sustitución obligatoria' : '¿Quién entra?'}</h3>
        {forzado && <p className="mensaje-error">Llegó al límite de faltas y tiene que salir de la cancha — elegí quién entra.</p>}
        <div className="selector-dorsal-grid">
          {banca.map((j) => (
            <button key={j.id} type="button" className="selector-dorsal-btn" onClick={() => onElegir(j.id)}>
              <span className="dorsal-chip">{j.dorsal ?? '-'}</span>
              {j.nombre && <span className="selector-dorsal-nombre">{j.nombre}</span>}
            </button>
          ))}
          {sinBanca && <p className="texto-tenue">No hay jugadores en la banca.</p>}
        </div>
        {sePuedeCerrar && (
          <button className="btn-link" onClick={onCerrar}>{forzado ? 'Seguir sin cambiar (no hay banca)' : 'Cancelar'}</button>
        )}
      </div>
    </div>
  );
}

// Resumen para quien maneja la Mesa — la misma información que el
// Intertanto de la transmisión (puntos por cuarto + líderes, si hay
// nóminas) más la tabla completa por jugador.
// Marcador por cámara + "Preguntar quién anotó": cada +1/+2/+3 que llega de
// la cámara se ofrece acá con las jugadoras en cancha de ese equipo. Si no
// se elige a nadie en 15 s, se omite (los puntos ya sumaron al marcador).
const SEGUNDOS_PARA_ASIGNAR = 15;
function AvisoAnotacion({ pendiente, equipo, jugadoras, restantes, onAsignar, onOmitir }) {
  return (
    <div className="mv-anotacion" role="dialog" aria-label="¿Quién anotó?" style={{ '--color-equipo': equipo.color }}>
      <div className="mv-anotacion-cabeza">
        <strong>+{pendiente.puntos} {equipo.nombre}</strong>
        <span>¿Quién anotó? · se omite en {restantes}s</span>
      </div>
      <div className="mv-anotacion-jugadoras">
        {jugadoras.length === 0 && <span className="texto-tenue">No hay quinteto cargado para este equipo.</span>}
        {jugadoras.map((j) => (
          <button key={j.id} type="button" className="mv-anotacion-btn" onClick={() => onAsignar(j.id)}>
            <b>{j.dorsal ?? '–'}</b>{j.nombre && <span>{j.nombre}</span>}
          </button>
        ))}
      </div>
      <button type="button" className="btn-link" onClick={onOmitir}>Omitir (solo suma al marcador)</button>
    </div>
  );
}

function ModalResumen({ partido, intertantoActivo, onAlternarIntertanto, onCerrar }) {
  const columnas = tablaPorPeriodo(partido);
  const lideres = lideresPartido(partido, ['pts', 'reb', 'ast', 'stl']);
  const { titulo, subtitulo } = tituloIntertanto(partido);
  const filaEquipo = (lado, equipo, total) => (
    <tr key={lado}>
      <th scope="row"><span className="resumen-punto" style={{ background: equipo.color }} />{equipo.nombre}</th>
      {columnas.map((c) => <td key={c.periodo} className={c[lado] == null ? 'texto-tenue' : ''}>{c[lado] ?? '–'}</td>)}
      <td className="resumen-total">{total}</td>
    </tr>
  );
  const nombreLider = (dato) => (dato?.sinNomina ? 'Sin nómina' : dato ? `#${dato.jugador.dorsal ?? '–'} ${dato.jugador.nombre || ''} · ${dato.valor}` : '—');
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja modal-resumen" onClick={(e) => e.stopPropagation()}>
        <div className="modal-resumen-cabecera">
          <div>
            <h3 style={{ margin: 0 }}>{titulo}</h3>
            <span className="texto-tenue">{subtitulo}</span>
          </div>
          <button type="button" className={intertantoActivo ? 'btn-peligro-suave' : 'btn-primario'} onClick={onAlternarIntertanto}>
            {intertantoActivo ? '■ Quitar de la transmisión' : '▶ Mostrar Intertanto en vivo'}
          </button>
        </div>
        <div className="resumen-tabla-scroll">
          <table className="resumen-cuartos">
            <thead>
              <tr><th />{columnas.map((c) => <th key={c.periodo}>{c.etiqueta}</th>)}<th>T</th></tr>
            </thead>
            <tbody>
              {filaEquipo('local', partido.equipoLocal, partido.ptsLocal)}
              {filaEquipo('visita', partido.equipoVisita, partido.ptsVisita)}
            </tbody>
          </table>
        </div>
        {hayNominas(partido) ? (
          <div className="resumen-lideres">
            {lideres.map((cat) => (
              <div key={cat.clave} className="resumen-lider">
                <span className="resumen-lider-cat">{cat.etiqueta}</span>
                <span>{nombreLider(cat.local)}</span>
                <span>{nombreLider(cat.visita)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="texto-tenue">Cargá las nóminas para ver líderes y estadísticas por jugador — sin nómina, el Intertanto muestra solo el marcador y los puntos por cuarto.</p>
        )}
        {hayNominas(partido) && <TablaEstadisticas equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} />}
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
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [categoriaNueva, setCategoriaNueva] = useState('');
  const [ramaNueva, setRamaNueva] = useState('');
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [equipoNuevo, setEquipoNuevo] = useState(null);
  const [rosterNuevo, setRosterNuevo] = useState([]);
  const [error, setError] = useState('');

  const disponibles = equipos.filter((e) => e.id !== equipoActualId && e.jugadores_count > 0);

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
      <div className={`modal-caja mv-modal-elegir-equipo ${creando ? '' : 'sn-modal'}`} onClick={(e) => e.stopPropagation()}>
        {error && <p className="mensaje-error">{error}</p>}

        {!creando ? (
          <>
            <div className="sn-modal-cabeza">
              <h3>Elegir nómina de un equipo guardado</h3>
              <button type="button" className="sn-cerrar" onClick={onCerrar} title="Cerrar">✕</button>
            </div>
            <SelectorNomina equipos={disponibles} onElegir={(e) => onUsar(e.id)} />

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

      <button type="button" className="mv-pill" style={{ width: '100%' }} onClick={onReiniciar}>↺ Reiniciar</button>
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

// Corrección manual de las faltas de EQUIPO del período (las que disparan
// el bonus, `partido.faltasPeriodoLocal/Visita` — ver el comentario junto a
// mv-scorebar más abajo) — mismo lápiz → número → ✓/✕ que las dos de
// arriba, pero compacto para convivir en la línea chica "F: N" del pie de
// cada caja de equipo en vez de ocupar una línea propia. `enBonus` agrega
// una clase CSS que resalta la caja (borde/texto de alerta) en cuanto llega
// a 4 (FIBA: penalización desde la 4ª falta de equipo del cuarto) — usa
// directamente `bonusLocal/bonusVisita` del backend.
function FaltasEquipoCorregibles({ valor, enBonus, editando, valorEdit, onEmpezar, onCambiarValor, onConfirmar, onCancelar }) {
  if (editando) {
    return (
      <span className="mv-faltas-equipo-edit">
        F:
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
    <span className={`mv-faltas ${enBonus ? 'mv-faltas-bonus' : ''}`}>
      F: {valor}{enBonus ? ' · BONUS' : ''}
      <button type="button" className="mv-faltas-equipo-corregir" title="Corregir faltas de equipo" onClick={onEmpezar}>✎</button>
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
  // Conexión con el servidor: si se corta, se avisa (Socket.IO guarda las
  // jugadas y las manda solas al volver).
  const [conectado, setConectado] = useState(true);
  const [bocinaActiva, setBocinaActiva] = useState(() => { try { return localStorage.getItem('mesa_bocina') !== 'no'; } catch { return true; } });
  const [verAtajos, setVerAtajos] = useState(false);
  // Tipo de mesa elegido por quien opera (se recuerda en este equipo).
  const [tipoMesa, setTipoMesa] = useState(() => { try { return localStorage.getItem('mesa_tipo') || 'clasica'; } catch { return 'clasica'; } });
  const elegirTipoMesa = (t) => { setTipoMesa(t); try { localStorage.setItem('mesa_tipo', t); } catch { /* opcional */ } };
  const [temaMesa, setTemaMesa] = useState(() => { try { return localStorage.getItem('mesa_tema') || 'original'; } catch { return 'original'; } });
  const elegirTemaMesa = (t) => { setTemaMesa(t); try { localStorage.setItem('mesa_tema', t); } catch { /* opcional */ } };
  const clasica = tipoMesa === 'clasica';
  // Cajón de gráficos (Tablet y Por jugadora lo pliegan; Consola lo deja fijo al costado).
  const [aireAbierto, setAireAbierto] = useState(false);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);
  // Mesa propia (no embebida): ocupa siempre la pantalla visible exacta, sin
  // scroll de página; "Pantalla completa" solo suma esconder la barra del navegador.
  const modoApp = !embebido || enPantallaCompleta;
  const [verConfig, setVerConfig] = useState(false);
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
  // Intertanto (resumen grande entre cuartos) en la transmisión — el estado
  // real lo lleva el servidor (se apaga solo al arrancar el reloj), acá se
  // refleja lo que llega por socket.
  const [intertantoActivo, setIntertantoActivo] = useState(false);
  // Aviso flotante de fin de cuarto: queda hasta responderlo, o se va solo al
  // arrancar el reloj o cambiar de cuarto (igual que el Intertanto al aire).
  const [finCuarto, setFinCuarto] = useState(null);
  // Marcador por cámara: estado del celular lector (latido + lecturas) y
  // el panel para activarlo / conectar con QR.
  const [lectorEstado, setLectorEstado] = useState(null);
  const [mostrarCamara, setMostrarCamara] = useState(false);
  // Cola de anotaciones de la cámara esperando "¿quién anotó?".
  const [anotacionesPendientes, setAnotacionesPendientes] = useState([]);
  const [segundosAviso, setSegundosAviso] = useState(SEGUNDOS_PARA_ASIGNAR);
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
  // null | 'local' | 'visita' — corrección manual de las faltas de EQUIPO
  // del período (distintas de las personales de arriba; son las que
  // disparan el bonus). Mismo patrón lápiz → número → ✓/✕.
  const [editandoFaltasEquipo, setEditandoFaltasEquipo] = useState(null);
  const [valorFaltasEquipoEdit, setValorFaltasEquipoEdit] = useState('');
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
  // Al disparar Nómina/Estadísticas: si se tapa el marcador base mientras
  // esa capa está en pantalla, o se lo deja visible debajo (por defecto).
  const [ocultarMarcador, setOcultarMarcador] = useState(false);
  // Presentación automática: al dar Play se presenta a cada jugador/a de a
  // uno, del dorsal más bajo al más alto (`paso` de `total`).
  const [mostrarPresentacion, setMostrarPresentacion] = useState(false);
  const [equipoPresentar, setEquipoPresentar] = useState('local');
  // null = usar el tiempo elegido en el diseño (Personalizar → Nómina → Presentación).
  const [segundosPresentacion, setSegundosPresentacion] = useState(null);
  const [presentacionAuto, setPresentacionAuto] = useState(null);
  const presentacionTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(presentacionTimerRef.current), []);
  // null = todavía no se sabe; 0+ = cuántas fuentes (OBS u otro navegador)
  // están mirando el enlace del marcador ahora mismo.
  const [viewersMarcador, setViewersMarcador] = useState(null);
  const socketRef = useRef(null);
  const mesaEnVivoRef = useRef(null);
  // Pantalla completa nativa sobre TODA la Mesa (no solo el tablero): así las
  // ventanas (tiro libre, cambio, nómina, quinteto, resumen…) siguen a la vista.
  const mesaRaizRef = useRef(null);
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
      if (activar) (mesaRaizRef.current || mesaEnVivoRef.current)?.requestFullscreen?.().catch(() => {});
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
  const alternarIntertanto = () => {
    const activo = !intertantoActivo;
    setIntertantoActivo(activo);
    setPantallaEspecial(null);
    emitirAccion('INTERTANTO', { activo, ocultarMarcador: true });
  };
  // Previa / Final / Jugadora del partido: el mismo panel grande con otro
  // contenido. Tocar el que ya está en pantalla lo saca.
  const [pantallaEspecial, setPantallaEspecial] = useState(null);
  const mostrarPantalla = (modo) => {
    const activo = pantallaEspecial !== modo;
    setPantallaEspecial(activo ? modo : null);
    setIntertantoActivo(false);
    emitirAccion('INTERTANTO', { activo, modo, ocultarMarcador: true });
  };

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
      socket.on('connect', () => { setConectado(true); socket.emit('unirse_mesa', { publicToken: d.partido.publicToken }); });
      socket.on('disconnect', () => setConectado(false));
      socket.io.on('reconnect_attempt', () => setConectado(false));
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
      socket.on('jugada_deshecha', () => setJugadas((prev) => prev.slice(1)));
      // Estado en vivo de la transmisión: el servidor lo recuerda y lo
      // reenvía al conectarse — así dos Mesas abiertas (o una recargada)
      // muestran siempre el botón en el estado real.
      // Mismo panel para Intertanto y las pantallas grandes (Previa/Final/Jugadora):
      // cada botón refleja solo lo suyo.
      socket.on('intertanto', (d) => {
        const modoAire = d?.activo ? (d.modo || 'intertanto') : null;
        setIntertantoActivo(modoAire === 'intertanto');
        setPantallaEspecial(modoAire && modoAire !== 'intertanto' ? modoAire : null);
      });
      // Fin de cuarto (reloj en 0:00): la Mesa pregunta si se muestra el Intertanto.
      socket.on('fin_periodo', (d) => setFinCuarto({ periodo: Number(d?.periodo) || null, ts: d?.ts || Date.now() }));
      socket.on('lector_estado', (d) => setLectorEstado(d));
      socket.on('anotacion_pendiente', (d) => setAnotacionesPendientes((prev) => [...prev, d].slice(-6)));
      socket.on('marcador_visibilidad', ({ oculto }) => setMarcadorOculto(Boolean(oculto)));
      socket.on('marcador_alerta', (a) => {
        if (a?.autoOcultar) return;
        setAlertaMarcador(a?.texto ? { texto: a.texto, equipo: a.equipo || null } : null);
      });
      socket.on('error_marcador', (payload) => setError(payload.error));
      // Cuántas fuentes (OBS u otro navegador) están mirando el enlace del
      // marcador AHORA — el servidor avisa solo cada vez que alguien entra o
      // sale de esa escena puntual (ver escenaMarcadorTokenRef más abajo,
      // que se pide apenas se sabe cuál es el token de esa escena).
      socket.on('escena_viewers', ({ escenaToken, cantidad }) => {
        if (escenaToken === escenaMarcadorTokenRef.current) setViewersMarcador(cantidad);
      });
    }).catch((err) => {
      // Sin esto, un partido inexistente/sin permiso dejaba "Cargando
      // partido…" para siempre, sin decir qué pasó.
      if (activo) setError(err.message || 'No se pudo cargar el partido');
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

  // Reloj interpolado (mismo cálculo que OBS): no espera el tick del servidor.
  const relojVivo = useRelojVivo(partido);
  // Bocina al llegar a 0:00 el reloj de juego (fin de cuarto).
  const relojPrevioRef = useRef(null);
  useEffect(() => {
    const previo = relojPrevioRef.current;
    relojPrevioRef.current = relojVivo;
    if (bocinaActiva && previo > 0 && relojVivo <= 0) sonarBocina(1.2);
  }, [relojVivo, bocinaActiva]);
  const alternarBocina = () => setBocinaActiva((v) => {
    try { localStorage.setItem('mesa_bocina', v ? 'no' : 'si'); } catch { /* opcional */ }
    if (!v) sonarBocina(0.25, 520); // muestra cómo suena
    return !v;
  });
  const deshacerUltima = () => partido?.ultimaJugada && emitirAccion('DESHACER', { eventoId: partido.ultimaJugada.id });
  const describirUltima = (u) => {
    if (!u) return '';
    const equipo = u.equipo === 'visita' ? partido.equipoVisita.nombre : partido.equipoLocal.nombre;
    const que = { PUNTO: `+${u.puntos}`, TIRO_LIBRE: `TL ${u.puntos}`, FALTA: 'Falta', REBOTE: 'Rebote', ASISTENCIA: 'Asistencia', ROBO: 'Robo', PERDIDA: 'Pérdida', TIMEOUT: 'Tiempo muerto' }[u.tipo] || u.tipo;
    return `${que} ${equipo}${u.jugador ? ` (${u.jugador})` : ''}`;
  };
  // Teclado: solo con la Mesa en vivo a la vista (también embebida en "Juego en vivo").
  // getClientRects (no offsetParent): en pantalla completa el tablero es position:fixed y offsetParent da null.
  useAtajosMesa(() => Boolean(partido?.estado === 'en_curso' && mesaEnVivoRef.current?.getClientRects().length), {
    reloj: () => emitirAccion(partido.relojCorriendo ? 'RELOJ_PAUSAR' : 'RELOJ_INICIAR'),
    puntos: (n) => emitirAccion('PUNTO', { equipo: equipoActivo, jugadorId: jugadorSeleccionadoId || null, puntos: n }),
    falta: () => emitirAccion('FALTA', { equipo: equipoActivo, jugadorId: jugadorSeleccionadoId || null, tipoFalta: 'personal' }),
    timeout: () => emitirAccion('TIMEOUT', { equipo: equipoActivo }),
    equipo: (e) => { setEquipoActivo(e); setJugadorSeleccionadoId(null); },
    deshacer: deshacerUltima,
  });
  const posesionViva = useRelojPosesion(partido);
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

  const empezarCorreccionFaltasEquipo = (equipo) => {
    setEditandoFaltasEquipo(equipo);
    setValorFaltasEquipoEdit(String(equipo === 'local' ? partido.faltasPeriodoLocal : partido.faltasPeriodoVisita));
  };
  const confirmarCorreccionFaltasEquipo = () => {
    const faltas = Number(valorFaltasEquipoEdit);
    if (Number.isInteger(faltas) && faltas >= 0) {
      emitirAccion('FALTAS_EQUIPO_CORREGIR', { equipo: editandoFaltasEquipo, faltas });
    }
    setEditandoFaltasEquipo(null);
  };
  const cancelarCorreccionFaltasEquipo = () => setEditandoFaltasEquipo(null);

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

  // Cuenta regresiva del aviso "¿quién anotó?" (el primero de la cola).
  const anotacionActual = anotacionesPendientes[0];
  useEffect(() => {
    if (!anotacionActual) return undefined;
    const inicio = Date.now();
    setSegundosAviso(SEGUNDOS_PARA_ASIGNAR);
    const id = setInterval(() => {
      const quedan = SEGUNDOS_PARA_ASIGNAR - Math.floor((Date.now() - inicio) / 1000);
      if (quedan <= 0) {
        clearInterval(id);
        const vencido = anotacionActual.eventoId;
        setAnotacionesPendientes((prev) => prev.filter((p) => p.eventoId !== vencido));
      } else {
        setSegundosAviso(quedan);
      }
    }, 250);
    return () => clearInterval(id);
  }, [anotacionActual?.eventoId]);

  // Los errores de acciones (jugada rechazada, sin permiso…) se muestran un
  // rato y se van solos — antes quedaban pegados arriba para siempre.
  useEffect(() => {
    if (!error || !partido) return undefined;
    const t = setTimeout(() => setError(''), 6000);
    return () => clearTimeout(t);
  }, [error, partido]);

  // "En pantalla" abierto: tocar o hacer clic afuera de la caja la esconde.
  useEffect(() => {
    if (!aireAbierto) return undefined;
    const alTocar = (ev) => { if (!ev.target.closest?.('.mv-aire')) setAireAbierto(false); };
    document.addEventListener('pointerdown', alTocar);
    return () => document.removeEventListener('pointerdown', alTocar);
  }, [aireAbierto]);

  // El aviso de fin de cuarto se va solo al arrancar el reloj o cambiar de cuarto.
  useEffect(() => {
    if (finCuarto && partido && (partido.relojCorriendo || (finCuarto.periodo && partido.periodo !== finCuarto.periodo))) setFinCuarto(null);
  }, [finCuarto, partido]);

  if (!partido) {
    if (error) return <p className="mensaje-error">{error}</p>;
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



  const escenaMarcadorActual = escenas.find((e) => e.tipo === 'marcador');

  const reproducirNomina = (modo) => emitirAccion('NOMINA_REPRODUCIR', { modo, ocultarMarcador });
  // Presentación automática por dorsal (menor a mayor). Cada paso manda la
  // lista acumulada de ESE equipo: el último es quien entra en grande y el
  // resto queda en la fila de abajo (ver VistaNomina, modo 'presentacion').
  const ordenarPorDorsal = (roster) => [...roster].sort((a, b) => {
    const da = Number.isFinite(Number(a.dorsal)) && a.dorsal !== null ? Number(a.dorsal) : 999;
    const db = Number.isFinite(Number(b.dorsal)) && b.dorsal !== null ? Number(b.dorsal) : 999;
    return da - db || (a.nombre || '').localeCompare(b.nombre || '');
  });
  const colaPresentacion = (cual) => [
    ...(cual !== 'visita' ? ordenarPorDorsal(partido.equipoLocal.roster).map((j) => ({ equipo: 'local', jugador: j })) : []),
    ...(cual !== 'local' ? ordenarPorDorsal(partido.equipoVisita.roster).map((j) => ({ equipo: 'visita', jugador: j })) : []),
  ];
  const detenerPresentacion = () => {
    clearTimeout(presentacionTimerRef.current);
    setPresentacionAuto(null);
  };
  const segundosDiseno = Number(disenos.find((d) => d.id === escenaMarcadorActual?.diseno_id)?.config?.presentacionSegundosJugador) || 4;
  const segundosPorJugador = segundosPresentacion ?? segundosDiseno;
  const iniciarPresentacion = () => {
    clearTimeout(presentacionTimerRef.current);
    const cola = colaPresentacion(equipoPresentar);
    if (!cola.length) return;
    const espera = segundosPorJugador * 1000;
    const paso = (k) => {
      const actual = cola[k];
      const ids = cola.slice(0, k + 1).filter((c) => c.equipo === actual.equipo).map((c) => c.jugador.id);
      emitirAccion('NOMINA_REPRODUCIR', { modo: 'presentacion', equipo: actual.equipo, jugadorIds: ids, ocultarMarcador });
      setPresentacionAuto({ paso: k + 1, total: cola.length, jugador: actual.jugador });
      presentacionTimerRef.current = setTimeout(() => (k + 1 < cola.length ? paso(k + 1) : setPresentacionAuto(null)), espera);
    };
    paso(0);
  };

  // Piezas que cada tipo de mesa ubica en otro lugar (mismos botones, mismas acciones).
  const botonesPantallas = [['previa', '🎬 Previa'], ['final', '🏁 Final'], ['mvp', '⭐ Jugadora del partido']].map(([modo, etiqueta]) => (
    <button key={modo} className={pantallaEspecial === modo ? 'btn-peligro-suave' : 'btn-secundario'} onClick={() => mostrarPantalla(modo)} title="Se muestra en la transmisión; tocá de nuevo para sacarla">
      {pantallaEspecial === modo ? `✕ Quitar ${etiqueta.replace(/^\S+ /, '')}` : etiqueta}
    </button>
  ));
  const botonesAire = (
    <>
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
      <button
        className={`mv-pill ${intertantoActivo ? 'mv-pill-alerta' : 'mv-pill-destacada'}`}
        title="Muestra en la transmisión el resumen entre cuartos: marcador, puntos por cuarto y, si hay nóminas, comparativa y líderes. Se quita solo al volver a arrancar el reloj."
        onClick={alternarIntertanto}
      >
        {intertantoActivo ? '■ Quitar Intertanto' : '📊 Intertanto'}
      </button>
      {escenaMarcadorActual && (
        <button className="mv-pill" onClick={() => copiarLinkFooter(escenaMarcadorActual.public_token)}>
          {copiadoFooter === escenaMarcadorActual.public_token ? '✓ Enlace copiado' : '🔗 Copiar enlace del marcador'}
        </button>
      )}
    </>
  );
  const disparadoresMesa = (
    <div className="mv-disparadores mv-disparadores-compacto">
      <div className="mv-aire-botones">
        <button className="mv-pill" title="Mostrar la nómina de Local" onClick={() => reproducirNomina('local')}>👥 Nómina Local</button>
        <button className="mv-pill" title="Mostrar la nómina de Visita" onClick={() => reproducirNomina('visita')}>👥 Nómina Visita</button>
        <button className="mv-pill" title="Mostrar las dos nóminas" onClick={() => reproducirNomina('ambos')}>👥 Ambas nóminas</button>
        <button
          className={`mv-pill mv-pill-destacada ${mostrarPresentacion ? 'activo' : ''}`}
          title="Presentar a cada jugador/a de a uno, con foto y nombre en grande"
          onClick={() => { setAireAbierto(false); setMostrarPresentacion(true); }}
        >
          🎬 Presentar jugadores
        </button>
      </div>
      <label className="mv-check-detalle mv-aire-check" title="Ocultar el marcador mientras se muestra la nómina">
        <input type="checkbox" checked={ocultarMarcador} onChange={(e) => setOcultarMarcador(e.target.checked)} />
        Ocultar el marcador mientras se muestra la nómina
      </label>
    </div>
  );

  return (
    <div className={`${embebido ? '' : 'pagina'} ${enPantallaCompleta ? 'mv-raiz-completa' : ''}`} ref={mesaRaizRef}>
      {error && <p className="mensaje-error">{error}</p>}

      {partido.estado === 'en_curso' && !modoApp && (
        <div className="mt-tipo-wrap">
          <span>Tipo de mesa</span>
          <div className="mt-tipo" role="group" aria-label="Tipo de mesa">
            {TIPOS_MESA.map((t) => <button key={t.id} type="button" className={tipoMesa === t.id ? 'activo' : ''} onClick={() => elegirTipoMesa(t.id)}>{t.etiqueta}</button>)}
          </div>
        </div>
      )}
      {!(modoApp && partido.estado === 'en_curso') && <div className="fila-form">
        <button className="btn-secundario" onClick={() => setMostrarResumen(true)}>📊 Resumen / intertanto</button>
        {clasica && botonesPantallas}
        <button className="btn-secundario" onClick={() => setMostrarGestionEscenas((v) => !v)}>
          {mostrarGestionEscenas ? 'Ocultar gestión de escenas' : 'Gestión avanzada de escenas'}
        </button>
      </div>}

      {mostrarGestionEscenas && !(modoApp && partido.estado === 'en_curso') && (
        <PanelEscenas escenas={escenas} disenos={disenos} onCambio={cargarEscenas} />
      )}

      {/* Armar equipos (nómina + quinteto) ya no pasa acá — se hace antes,
          en "Personalizar tablero → Equipos", así que el partido ya nace
          "en_curso" directo a la mesa en vivo. */}

      {partido.estado === 'en_curso' && (
        <div className={`mv-wrap mv-tipo-${tipoMesa} ${temaMesa !== 'original' ? `mt-tema mt-tema-${temaMesa}` : ''} ${modoApp ? 'mv-app' : ''} ${modoApp || enPantallaCompleta ? 'mv-pantalla-completa' : ''}`} ref={mesaEnVivoRef} style={{ '--mt-local': partido.equipoLocal.color || '#ff3b30', '--mt-visita': partido.equipoVisita.color || '#0a84ff' }}>
          {finCuarto && (
            <div className="mv-fin-cuarto" role="dialog" aria-label="Fin del cuarto">
              <div className="mv-fin-cuarto-cabeza">
                <span className="mv-fin-cuarto-icono" aria-hidden="true">⏱</span>
                <div>
                  <p className="mv-fin-cuarto-titulo">Terminó el {etiquetaPeriodo(finCuarto.periodo || partido.periodo)}</p>
                  <p className="mv-fin-cuarto-texto">
                    {intertantoActivo
                      ? 'Intertanto en pantalla. Se quita solo al iniciar el próximo cuarto o al cambiar el período.'
                      : '¿Mostrar el intertanto en la transmisión?'}
                  </p>
                </div>
                <button type="button" className="mv-panel-cerrar" onClick={() => setFinCuarto(null)} title="Cerrar aviso">✕</button>
              </div>
              <div className="mv-fin-cuarto-botones">
                {intertantoActivo ? (
                  <button type="button" className="mv-pill mv-pill-alerta" onClick={alternarIntertanto}>■ Quitar intertanto</button>
                ) : (
                  <>
                    <button type="button" className="mv-btn-electrico" onClick={alternarIntertanto}>📊 Mostrar intertanto</button>
                    <button type="button" className="mv-pill" onClick={() => setFinCuarto(null)}>Ahora no</button>
                  </>
                )}
              </div>
            </div>
          )}
          {modoApp && mostrarGestionEscenas && (
            <div className="mv-panel-fondo mv-escenas-fondo" onClick={() => setMostrarGestionEscenas(false)}>
              <div className="mv-escenas-caja" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="mv-panel-cerrar" onClick={() => setMostrarGestionEscenas(false)} title="Cerrar">✕</button>
                <PanelEscenas escenas={escenas} disenos={disenos} onCambio={cargarEscenas} />
              </div>
            </div>
          )}
          {modoApp ? (
            <div className="mv-barra-app">
          <aside className={`mv-aire ${aireAbierto ? 'abierto' : ''}`} aria-label="Gráficos en pantalla">
            <button type="button" className="mv-aire-titulo" onClick={() => setAireAbierto((v) => !v)} aria-expanded={aireAbierto}>
              <span>📺 En pantalla</span>
              <span className="mv-aire-resumen">{[!marcadorOculto && 'Marcador', intertantoActivo && 'Intertanto', pantallaEspecial && ({ previa: 'Previa', final: 'Final', mvp: 'Jugadora del partido', tabla: 'Tabla' })[pantallaEspecial], alertaMarcador?.texto === 'ENTRETIEMPO' && 'Entretiempo'].filter(Boolean).join(' · ') || 'Nada al aire'}</span>
              <span className="mv-aire-flecha">{aireAbierto ? '▴' : '▾'}</span>
            </button>
            <div className="mv-aire-cuerpo">
              <p className="mv-aire-seccion">Marcador</p>
              <div className="mv-aire-botones">{botonesAire}</div>
              <p className="mv-aire-seccion">Pantallas grandes</p>
              <div className="mv-aire-botones">{botonesPantallas}</div>
              <p className="mv-aire-seccion">Nómina</p>
              {disparadoresMesa}
            </div>
          </aside>
              <div className="mv-barra-rapida">
                <button className="mv-pill mv-deshacer" disabled={!partido.ultimaJugada} onClick={deshacerUltima} title={partido.ultimaJugada ? `Deshacer: ${describirUltima(partido.ultimaJugada)} (Ctrl+Z)` : 'Nada para deshacer'}>
                  ↶ {partido.ultimaJugada ? <>Deshacer <small>{describirUltima(partido.ultimaJugada)}</small></> : 'Nada para deshacer'}
                </button>
                <span className={`mv-pill ${conectado ? 'mv-ok' : 'mv-pill-alerta'}`} title={conectado ? 'Conectado al servidor' : 'Sin conexión: las jugadas se guardan y se envían solas al volver'}>
                  {conectado ? '🟢 Conectado' : '🔴 Sin conexión'}
                </span>
                {escenaMarcadorActual && (
                  <span className={`mv-pill ${viewersMarcador > 0 ? 'mv-ok' : 'mv-pill-alerta'}`} title="Fuentes (OBS u otro navegador) con el enlace del marcador abierto">
                    {viewersMarcador === null ? '📡 …' : viewersMarcador > 0 ? `📡 OBS: ${viewersMarcador}` : '📡 OBS: nadie'}
                  </span>
                )}
                <button className="mv-pill" onClick={alternarPantallaCompleta}>{enPantallaCompleta ? '✕ Salir' : '⛶ Pantalla completa'}</button>
                <button className={`mv-pill mv-btn-config ${verConfig ? 'activa' : ''}`} onClick={() => setVerConfig(true)} title="Configuración de la mesa">⚙ Configuración</button>
              </div>
            </div>
          ) : (
            <>
          <div className="mv-topbar">
            <span className={`mv-pill ${conectado ? '' : 'mv-pill-alerta'}`} title={conectado ? 'Conectado al servidor' : 'Sin conexión: las jugadas se guardan y se envían solas al volver'}>
              {conectado ? '🟢 Conectado' : '🔴 Sin conexión · se envía al volver'}
            </span>
            <button className="mv-pill" disabled={!partido.ultimaJugada} onClick={deshacerUltima} title="Deshacer la última jugada (Ctrl+Z)">
              ↶ {partido.ultimaJugada ? `Deshacer: ${describirUltima(partido.ultimaJugada)}` : 'Nada para deshacer'}
            </button>
            <button className={`mv-pill ${bocinaActiva ? 'activa' : ''}`} onClick={alternarBocina} title="Bocina al terminar cada cuarto">
              {bocinaActiva ? '🔔 Bocina' : '🔕 Bocina'}
            </button>
            <button className={`mv-pill ${verAtajos ? 'activa' : ''}`} onClick={() => setVerAtajos((v) => !v)} title="Atajos de teclado">⌨️ Atajos</button>
            {verAtajos && (
              <div className="mv-atajos" role="note">
                {ATAJOS_MESA.map(([tecla, que]) => <span key={tecla}><kbd>{tecla}</kbd> {que}</span>)}
              </div>
            )}
            {/* A diferencia de "Mesa simple" (navega a otra página, no tiene
                sentido ofrecerlo adentro de "Juego en vivo" embebido), este
                botón solo copia al portapapeles — no saca de la pantalla, así
                que se muestra siempre, embebido o no. Antes quedaba escondido
                acá también, y "Juego en vivo" (el lugar donde de verdad se
                arma cada partido) es justo donde más falta hace. */}
            <button
              className={`mv-pill ${partido.sincronizacionCamara?.activo ? (lectorEstado?.conectado ? 'activa' : 'mv-pill-alerta') : ''}`}
              onClick={() => setMostrarCamara(true)}
              title="Leer el marcador del estadio (reloj, puntos, cuarto, faltas) con la cámara de un celular, o dejarlo manual"
            >
              {!partido.sincronizacionCamara?.activo
                ? '📷 Marcador: manual'
                : lectorEstado?.conectado ? '📷 Marcador por cámara ●' : '📷 Cámara sin señal'}
            </button>
            <button className="mv-pill" onClick={alternarPantallaCompleta}>
              {enPantallaCompleta ? '✕ Salir de Pantalla Completa' : '⛶ Pantalla Completa'}
            </button>
            {clasica && botonesAire}
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
            <details className="mv-mas">
              <summary className="mv-pill">☰ Más</summary>
              <div className="mv-mas-menu">
                {!embebido && <Link className="mv-pill" to={`/mesa/${id}/simple`}>📋 Mesa simple</Link>}
                {!embebido && escenaMarcadorActual?.diseno_id && <Link className="mv-pill" to={`/disenos?editar=${escenaMarcadorActual.diseno_id}`}>🎨 Personalizar</Link>}
                <button className="mv-pill" title="Vuelve el marcador a 0-0 para empezar otro partido — el enlace de OBS no cambia" onClick={reiniciarPartido}>↺ Reiniciar Partido</button>
                <button className="mv-pill mv-pill-peligro" title="El enlace de OBS sigue funcionando después de finalizar" onClick={finalizarPartido}>⏹ Finalizar Partido</button>
              </div>
            </details>
          </div>


              {clasica ? disparadoresMesa : (
              <aside className={`mv-aire ${aireAbierto ? 'abierto' : ''}`} aria-label="Gráficos en pantalla">
                <button type="button" className="mv-aire-titulo" onClick={() => setAireAbierto((v) => !v)} aria-expanded={aireAbierto}>
                  <span>📺 En pantalla</span>
                  <span className="mv-aire-resumen">{[!marcadorOculto && 'Marcador', intertantoActivo && 'Intertanto', pantallaEspecial && ({ previa: 'Previa', final: 'Final', mvp: 'Jugadora del partido', tabla: 'Tabla' })[pantallaEspecial], alertaMarcador?.texto === 'ENTRETIEMPO' && 'Entretiempo'].filter(Boolean).join(' · ') || 'Nada al aire'}</span>
                  <span className="mv-aire-flecha">{aireAbierto ? '▴' : '▾'}</span>
                </button>
                <div className="mv-aire-cuerpo">
                  <p className="mv-aire-seccion">Marcador</p>
                  <div className="mv-aire-botones">{botonesAire}</div>
                  <p className="mv-aire-seccion">Pantallas grandes</p>
                  <div className="mv-aire-botones">{botonesPantallas}</div>
                  <p className="mv-aire-seccion">Nómina</p>
                  {disparadoresMesa}
                </div>
              </aside>
              )}
            </>
          )}

          {modoApp && verConfig && (
            <div className="mv-panel-fondo mv-escenas-fondo" onClick={() => setVerConfig(false)}>
              <div className="mv-escenas-caja mv-config-caja" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Configuración de la mesa">
                <button type="button" className="mv-panel-cerrar" onClick={() => setVerConfig(false)} title="Cerrar">✕</button>
                <h3 className="mv-config-titulo">⚙ Configuración de la mesa</h3>
                <p className="mv-config-seccion">Tipo de mesa</p>
                <div className="mt-tipo mv-config-tipos" role="group" aria-label="Tipo de mesa">
                  {TIPOS_MESA.map((t) => <button key={t.id} type="button" className={tipoMesa === t.id ? 'activo' : ''} onClick={() => elegirTipoMesa(t.id)}>{t.etiqueta}</button>)}
                </div>
                <p className="mv-config-seccion">Color</p>
                <div className="mv-config-colores">
                  {TEMAS_MESA.map((t) => (
                    <button key={t.id} type="button" className={`mv-config-color mt-muestra-${t.id} ${temaMesa === t.id ? 'activo' : ''}`} onClick={() => elegirTemaMesa(t.id)}>
                      <span className="mv-config-muestra" aria-hidden="true" />{t.etiqueta}
                    </button>
                  ))}
                </div>
                <p className="mv-config-seccion">Mesa</p>
                <div className="mv-config-botones">
                  <button className="mv-pill" onClick={() => { setVerConfig(false); setMostrarResumen(true); }}>📊 Resumen / intertanto</button>
                  <button className={`mv-pill ${bocinaActiva ? 'activa' : ''}`} onClick={alternarBocina}>{bocinaActiva ? '🔔 Bocina: sí' : '🔕 Bocina: no'}</button>
                  <button className={`mv-pill ${partido.sincronizacionCamara?.activo ? (lectorEstado?.conectado ? 'activa' : 'mv-pill-alerta') : ''}`} onClick={() => { setVerConfig(false); setMostrarCamara(true); }} title="Leer el marcador del estadio con la cámara de un celular, o dejarlo manual">
                    {!partido.sincronizacionCamara?.activo ? '📷 Marcador: manual' : lectorEstado?.conectado ? '📷 Marcador por cámara ●' : '📷 Cámara sin señal'}
                  </button>
                  <button className={`mv-pill ${verAtajos ? 'activa' : ''}`} onClick={() => setVerAtajos((v) => !v)}>⌨️ Atajos</button>
                  <button className="mv-pill" onClick={() => { setVerConfig(false); setMostrarGestionEscenas(true); }}>🎬 Escenas</button>
                </div>
                {verAtajos && (
                  <div className="mv-config-atajos" role="note">
                    {ATAJOS_MESA.map(([tecla, que]) => <span key={tecla}><kbd>{tecla}</kbd> {que}</span>)}
                  </div>
                )}
                <p className="mv-config-seccion">Partido</p>
                <div className="mv-config-botones">
                  {!embebido && <Link className="mv-pill" to="/partidos">← Partidos</Link>}
                  {!embebido && <Link className="mv-pill" to={`/mesa/${id}/simple`}>📋 Mesa simple</Link>}
                  {!embebido && escenaMarcadorActual?.diseno_id && <Link className="mv-pill" to={`/disenos?editar=${escenaMarcadorActual.diseno_id}`}>🎨 Personalizar</Link>}
                  <button className="mv-pill" title="Vuelve el marcador a 0-0 para empezar otro partido — el enlace de OBS no cambia" onClick={() => { setVerConfig(false); reiniciarPartido(); }}>↺ Reiniciar partido</button>
                  <button className="mv-pill mv-pill-peligro" title="El enlace de OBS sigue funcionando después de finalizar" onClick={() => { setVerConfig(false); finalizarPartido(); }}>⏹ Finalizar partido</button>
                </div>
              </div>
            </div>
          )}

          {mostrarPresentacion && (
            <div className="mv-panel-fondo mv-escenas-fondo" onClick={() => setMostrarPresentacion(false)}>
              <div className="mv-escenas-caja mv-pres-caja" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Presentación de jugadores">
                <button type="button" className="mv-panel-cerrar" onClick={() => setMostrarPresentacion(false)} title="Cerrar">✕</button>
                <h3 className="mv-config-titulo">🎬 Presentación</h3>
                <p className="mv-pres-ayuda">Se presenta a cada jugador/a de a uno, del número más bajo al más alto, con foto y nombre en grande.</p>
                <p className="mv-config-seccion">1 · ¿A quién presentamos?</p>
                <div className="mv-pres-equipos">
                  {[
                    ['local', partido.equipoLocal.nombre, partido.equipoLocal.color, partido.equipoLocal.logo_url, partido.equipoLocal.roster.length],
                    ['visita', partido.equipoVisita.nombre, partido.equipoVisita.color, partido.equipoVisita.logo_url, partido.equipoVisita.roster.length],
                    ['ambos', 'Ambos', null, null, partido.equipoLocal.roster.length + partido.equipoVisita.roster.length],
                  ].map(([id, nombre, color, logo, n]) => (
                    <button key={id} type="button" className={`mv-pres-equipo ${equipoPresentar === id ? 'activo' : ''}`} style={{ '--pres-color': color || '#8e8e93' }} disabled={Boolean(presentacionAuto)} onClick={() => setEquipoPresentar(id)}>
                      {logo ? <img src={logo} alt="" /> : <span className="mv-pres-equipo-icono" aria-hidden="true">{id === 'ambos' ? '⇄' : nombre.charAt(0)}</span>}
                      <span className="mv-pres-equipo-nombre">{nombre}</span>
                      <span className="mv-pres-equipo-n">{id === 'ambos' ? `local y después visita · ${n}` : `${n} jugadores`}</span>
                    </button>
                  ))}
                </div>
                <p className="mv-config-seccion">2 · Orden de salida</p>
                <div className="mv-pres-orden">
                  {colaPresentacion(equipoPresentar).map((c, k) => (
                    <span key={`${c.equipo}-${c.jugador.id}`} className={`mv-pres-chip ${presentacionAuto && k < presentacionAuto.paso - 1 ? 'hecho' : ''} ${presentacionAuto && k === presentacionAuto.paso - 1 ? 'actual' : ''}`} style={{ '--pres-color': c.equipo === 'local' ? partido.equipoLocal.color : partido.equipoVisita.color }}>
                      #{c.jugador.dorsal ?? '–'}
                    </span>
                  ))}
                  {colaPresentacion(equipoPresentar).length === 0 && <span className="mv-texto-tenue">Este equipo no tiene jugadores cargados.</span>}
                </div>
                <p className="mv-config-seccion">3 · Tiempo y salida</p>
                {presentacionAuto ? (
                  <div className="mv-pres-curso">
                    <div className="mv-pres-barra"><span style={{ width: `${(presentacionAuto.paso / presentacionAuto.total) * 100}%` }} /></div>
                    <p className="mv-pres-ahora">En pantalla ({presentacionAuto.paso} de {presentacionAuto.total}): <b>#{presentacionAuto.jugador.dorsal ?? '–'} {presentacionAuto.jugador.nombre}</b></p>
                    <button type="button" className="mv-pill mv-pill-alerta mv-pres-boton" onClick={detenerPresentacion}>■ Detener presentación</button>
                  </div>
                ) : (
                  <div className="mv-pres-salida">
                    <label className="mv-pres-segundos">
                      Segundos por jugador
                      <select className="mv-select" value={segundosPorJugador} onChange={(e) => setSegundosPresentacion(Number(e.target.value))}>
                        {[...new Set([2, 3, 4, 5, 6, 8, 10, segundosPorJugador])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} s{n === segundosDiseno ? ' (diseño)' : ''}</option>)}
                      </select>
                    </label>
                    <button type="button" className="mv-btn-electrico mv-pres-boton" disabled={!colaPresentacion(equipoPresentar).length} onClick={iniciarPresentacion}>▶ Play</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {presentacionAuto && !mostrarPresentacion && (
            <button type="button" className="mv-pres-flotante" onClick={() => setMostrarPresentacion(true)} title="Ver la presentación en curso">
              🎬 Presentando {presentacionAuto.paso}/{presentacionAuto.total} · #{presentacionAuto.jugador.dorsal ?? '–'}
            </button>
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
                <FaltasEquipoCorregibles
                  valor={partido.faltasPeriodoLocal}
                  enBonus={Boolean(partido.bonusLocal)}
                  editando={editandoFaltasEquipo === 'local'}
                  valorEdit={valorFaltasEquipoEdit}
                  onEmpezar={() => empezarCorreccionFaltasEquipo('local')}
                  onCambiarValor={setValorFaltasEquipoEdit}
                  onConfirmar={confirmarCorreccionFaltasEquipo}
                  onCancelar={cancelarCorreccionFaltasEquipo}
                />
              </div>
            </div>

            <div className="mv-centro">
              <span className="mv-chip-competicion">Partido en curso</span>
              {/* Solo lectura acá — el control de verdad (editar a mano,
                  subir/bajar rápido) vive debajo de "Control de Partido",
                  más grande y pensado para el dedo, no para leer de reojo. */}
              <span className={`mv-reloj-lectura ${partido.relojCorriendo ? 'corriendo' : ''}`}>
                {formatearRelojVivo(relojVivo)}
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
                <FaltasEquipoCorregibles
                  valor={partido.faltasPeriodoVisita}
                  enBonus={Boolean(partido.bonusVisita)}
                  editando={editandoFaltasEquipo === 'visita'}
                  valorEdit={valorFaltasEquipoEdit}
                  onEmpezar={() => empezarCorreccionFaltasEquipo('visita')}
                  onCambiarValor={setValorFaltasEquipoEdit}
                  onConfirmar={confirmarCorreccionFaltasEquipo}
                  onCancelar={cancelarCorreccionFaltasEquipo}
                />
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
                <h6>Reloj y período</h6>
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

              <RuedaReloj
                segundos={Math.floor(relojVivo || 0)}
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

              {/* Reloj de posesión (FIBA): 24 al cambiar la posesión, 14 tras
                  falta/patada en campo de ataque. Corre con el reloj de juego. */}
              <div className="mv-posesion24" aria-label="Reloj de posesión">
                <span className="mv-posesion24-etq">Posesión</span>
                <span className={`mv-posesion24-valor ${posesionViva < 5 ? 'alerta' : ''} ${partido.posesionCorriendo ? 'corriendo' : ''}`}>{formatearPosesion(posesionViva)}</span>
                <button type="button" className="mv-pill" onClick={() => emitirAccion('POSESION_FIJAR', { segundos: 24 })}>24</button>
                <button type="button" className="mv-pill" onClick={() => emitirAccion('POSESION_FIJAR', { segundos: 14 })}>14</button>
                <button type="button" className="mv-pill mv-pill-chico" title="Restar un segundo" onClick={() => emitirAccion('POSESION_FIJAR', { segundos: Math.max(0, Math.floor(posesionViva) - 1) })}>−1</button>
                <button type="button" className="mv-pill mv-pill-chico" title="Sumar un segundo" onClick={() => emitirAccion('POSESION_FIJAR', { segundos: Math.min(24, Math.floor(posesionViva) + 1) })}>+1</button>
              </div>
              </div>

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

          {tipoMesa === 'jugadora' && !mostrarPanelAcciones && (
            <div className="mv-acciones-espera">Toca una jugadora en cancha para anotar sus acciones (o “Acciones Local/Visita” si el equipo juega sin nómina).</div>
          )}
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
          <div className="fila-form" style={{ justifyContent: 'center' }}>
            <button className="btn-secundario" onClick={reiniciarPartido}>🔄 Reiniciar partido (mismo enlace)</button>
            {!embebido && <Link className="btn-secundario" to="/partidos">📊 Ver estadísticas en Partidos</Link>}
          </div>
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

      {anotacionActual && (
        <AvisoAnotacion
          pendiente={anotacionActual}
          equipo={anotacionActual.equipo === 'visita' ? partido.equipoVisita : partido.equipoLocal}
          jugadoras={enCanchaDelEquipo(anotacionActual.equipo)}
          restantes={segundosAviso}
          onAsignar={(jugadorId) => {
            emitirAccion('ASIGNAR_ANOTACION', { eventoId: anotacionActual.eventoId, jugadorId });
            setAnotacionesPendientes((prev) => prev.filter((p) => p.eventoId !== anotacionActual.eventoId));
          }}
          onOmitir={() => setAnotacionesPendientes((prev) => prev.filter((p) => p.eventoId !== anotacionActual.eventoId))}
        />
      )}
      {mostrarCamara && (
        <PanelMarcadorCamara
          partido={partido}
          lector={lectorEstado}
          onCambiar={(config) => emitirAccion('SINCRONIZACION_CAMARA', config)}
          onCerrar={() => setMostrarCamara(false)}
        />
      )}
      {mostrarResumen && <ModalResumen partido={partido} intertantoActivo={intertantoActivo} onAlternarIntertanto={alternarIntertanto} onCerrar={() => setMostrarResumen(false)} />}

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
