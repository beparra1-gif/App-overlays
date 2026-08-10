import { useState } from 'react';
import { api } from '../api/client';

const MAX_QUINTETO = 5;
const MAX_FIBA = 12;

// Nómina (dorsal + nombre, tope blando FIBA de 12) y/o selección de quinteto
// en cancha — las dos cosas comparten la misma lista de jugadores, pero se
// usan en dos lugares distintos con propósitos distintos:
//  - Personalizar tablero → Equipos: `seleccionable={false}` — acá solo se
//    carga el plantel completo, el quinteto se elige después.
//  - Mesa de control: `permitirAgregar={false}` — acá el plantel ya está
//    armado, esto es solo para marcar quién arranca en cancha (se puede
//    volver a abrir en cualquier momento, p. ej. al empezar cada cuarto).
export default function EquipoRoster({
  equipo,
  roster,
  seleccionados = [],
  onCambiarQuinteto,
  onJugadorAgregado,
  // Quién persiste la fila nueva (o no): por defecto la guarda YA en el
  // equipo real (comportamiento de siempre, el que usa la Mesa de control
  // en un partido en curso — ahí SÍ tiene que quedar guardada al toque para
  // que sincronice con la transmisión). "Personalizar tablero → Equipos"
  // pasa su propia versión que NO pega contra el backend — solo arma la
  // lista en memoria hasta que el usuario decide guardarla de verdad.
  onAgregarJugador,
  seleccionable = true,
  permitirAgregar = true,
  // Sacar un jugador de la nómina — apagado por defecto (la selección de
  // quinteto en Mesa no lo necesita, solo elegir quién arranca en cancha).
  // `onEliminarJugador` es la misma idea que `onAgregarJugador`: quién
  // persiste (o no) el borrado. Por defecto pega contra el backend de
  // verdad — salvo que el jugador todavía esté "pendiente" (sin guardar,
  // ver EquipoFicha), ahí no hay nada que borrar en la base, solo sacarlo
  // de la lista en memoria. `onJugadorEliminado` avisa al padre para que
  // saque esa fila de su propio estado — mismo patrón que
  // `onJugadorAgregado`.
  permitirEliminar = false,
  onEliminarJugador,
  onJugadorEliminado,
  // Editar nombre/dorsal de un jugador ya cargado — apagado por defecto,
  // mismo criterio que permitirEliminar. `onEditarJugador` (opcional):
  // quién persiste el cambio; por defecto pega contra el backend de
  // verdad (PUT /jugadores/:id), salvo que el jugador todavía esté
  // "pendiente" (sin guardar, ver EquipoFicha) — ahí no hay nada que
  // actualizar en la base, solo se corrige la fila en memoria.
  // `onJugadorEditado` avisa al padre con el jugador ya actualizado, mismo
  // patrón que `onJugadorAgregado`/`onJugadorEliminado`.
  permitirEditar = false,
  onEditarJugador,
  onJugadorEditado,
  // Solo lo pasa la Mesa de control (un partido ya en curso, con id real):
  // habilita el checkbox "Solo para este partido" en el form de agregar, y
  // es lo que se manda como `partido_id` si se marca — el backend lo
  // guarda como jugador `temporal` atado a ESE partido (ver POST
  // /equipos/:id/jugadores), así que nunca queda en el plantel reusable
  // del equipo. "Personalizar tablero → Equipos" resuelve esto distinto
  // (un toggle propio, ver EquipoFicha) porque ahí el partido todavía no
  // existe cuando se cargan los jugadores.
  partidoId,
  // Tope de la selección múltiple (`seleccionable`) — 5 para el quinteto en
  // cancha (el de siempre), 12 para elegir convocados (ver ModalConvocados
  // en Mesa.jsx). Para convocados es un tope SUAVE: al llegar al tope
  // aparece "Elegir igual" (mismo criterio que el tope FIBA de la nómina),
  // así el usuario puede convocar a todo el plantel si lo necesita.
  maxSeleccion = MAX_QUINTETO,
  toqueSuave = false,
  etiquetaSeleccion = 'quinteto',
}) {
  const [dorsal, setDorsal] = useState('');
  const [nombreJugador, setNombreJugador] = useState('');
  const [soloEstePartido, setSoloEstePartido] = useState(false);
  const [forzarMasDeDoce, setForzarMasDeDoce] = useState(false);
  // Si ya arranca con más seleccionados que el tope (p. ej. convocados
  // precargado con el plantel completo, ver ModalConvocados en Mesa.jsx),
  // no tiene sentido que los checkboxes nazcan deshabilitados — el usuario
  // todavía no hizo nada, no hay "tope alcanzado" que anunciarle recién
  // abriendo.
  const [forzarMasSeleccion, setForzarMasSeleccion] = useState(() => seleccionados.length > maxSeleccion);
  const [error, setError] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [dorsalEdit, setDorsalEdit] = useState('');
  const [nombreEdit, setNombreEdit] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const alternar = (jugadorId) => {
    if (!seleccionable) return;
    const yaEsta = seleccionados.includes(jugadorId);
    if (yaEsta) return onCambiarQuinteto(seleccionados.filter((id) => id !== jugadorId));
    if (seleccionados.length >= maxSeleccion && !(toqueSuave && forzarMasSeleccion)) return;
    onCambiarQuinteto([...seleccionados, jugadorId]);
  };

  const agregarJugador = async (e) => {
    e.preventDefault();
    setError('');
    // A veces se carga la nómina antes de tener el nombre real de cada
    // jugadora — el dorsal solo ya alcanza para identificarla en cancha,
    // el nombre se completa después con "Editar". Lo único obligatorio es
    // que quede AL MENOS uno de los dos.
    if (!nombreJugador.trim() && !dorsal.trim()) return setError('Poné al menos el dorsal o el nombre del jugador');
    try {
      const datos = { nombre: nombreJugador.trim(), dorsal: dorsal || null };
      if (partidoId && soloEstePartido) { datos.temporal = true; datos.partido_id = partidoId; }
      const jugador = onAgregarJugador
        ? await onAgregarJugador(datos)
        : (await api.crearJugador(equipo.id, datos)).jugador;
      onJugadorAgregado(jugador);
      setDorsal('');
      setSoloEstePartido(false);
      setNombreJugador('');
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminarJugador = async (jugador) => {
    if (!window.confirm(`¿Sacar a ${jugador.nombre} de la nómina? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      if (!jugador.pendiente) {
        if (onEliminarJugador) await onEliminarJugador(jugador);
        else await api.eliminarJugador(jugador.id);
      }
      onJugadorEliminado?.(jugador.id);
    } catch (err) {
      // Un jugador que ya anotó puntos/faltas en el partido tiene jugadas
      // guardadas (eventos_partido) — borrarlo de una chocaba con eso y
      // quedaba sin salida ("no se pudo eliminar"). El backend ahora avisa
      // cuántas jugadas hay; club el puntaje total del equipo no se toca
      // (vive aparte, ya sumado), solo se pierde el detalle jugada por
      // jugada de ESE jugador si se confirma borrarlo igual.
      if (err.data?.eventos_bloqueando) {
        const cantidad = err.data.eventos_bloqueando;
        const confirmado = window.confirm(
          `${jugador.nombre} ya tiene ${cantidad} jugada${cantidad === 1 ? '' : 's'} anotada${cantidad === 1 ? '' : 's'} en este partido. ` +
          `El puntaje del equipo no cambia, pero se pierde el detalle de esas jugadas para este jugador. Esta acción no se puede deshacer. ¿Eliminarlo igual?`
        );
        if (!confirmado) return;
        try {
          if (onEliminarJugador) await onEliminarJugador(jugador, { forzar: true });
          else await api.eliminarJugador(jugador.id, { forzar: true });
          onJugadorEliminado?.(jugador.id);
        } catch (err2) {
          setError(err2.message);
        }
        return;
      }
      setError(err.message);
    }
  };

  const alcanzoTopeFiba = roster.length >= MAX_FIBA && !forzarMasDeDoce;

  const iniciarEdicion = (jugador) => {
    setError('');
    setEditandoId(jugador.id);
    setDorsalEdit(jugador.dorsal ?? '');
    setNombreEdit(jugador.nombre);
  };
  const cancelarEdicion = () => setEditandoId(null);

  const guardarEdicion = async (jugador, e) => {
    e.preventDefault();
    const nombreLimpio = nombreEdit.trim();
    if (!nombreLimpio && !dorsalEdit.trim()) return setError('Poné al menos el dorsal o el nombre del jugador');
    setError('');
    setGuardandoEdicion(true);
    try {
      const datos = { nombre: nombreLimpio, dorsal: dorsalEdit === '' ? null : dorsalEdit };
      // Un jugador "pendiente" (ver EquipoFicha) todavía no existe en la
      // base — no hay nada que actualizar ahí, solo corregir la fila en
      // memoria con lo recién tipeado.
      const actualizado = jugador.pendiente
        ? { ...jugador, ...datos }
        : onEditarJugador
          ? await onEditarJugador(jugador, datos)
          : (await api.actualizarJugador(jugador.id, datos)).jugador;
      onJugadorEditado?.(actualizado);
      setEditandoId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  return (
    <div className="tarjeta">
      <h3>
        {equipo.nombre}
        {seleccionable && <span className="texto-tenue"> — {etiquetaSeleccion} {seleccionados.length}/{maxSeleccion}</span>}
      </h3>
      {error && <p className="mensaje-error">{error}</p>}
      {seleccionable && toqueSuave && seleccionados.length >= maxSeleccion && !forzarMasSeleccion && (
        <div className="mensaje-error">
          Llegaste a {maxSeleccion}. <button type="button" className="btn-link" onClick={() => setForzarMasSeleccion(true)}>Elegir igual</button>
        </div>
      )}
      <ul className="lista-seleccion">
        {roster.map((j) => (
          <li key={j.id} style={{ justifyContent: 'space-between' }}>
            {editandoId === j.id ? (
              <form className="fila-form" style={{ flex: 1, margin: 0 }} onSubmit={(e) => guardarEdicion(j, e)}>
                <input placeholder="Dorsal" value={dorsalEdit} onChange={(e) => setDorsalEdit(e.target.value)} style={{ width: 70 }} autoFocus />
                <input placeholder="Nombre" value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} style={{ flex: 1, minWidth: 100 }} />
                <button className="btn-secundario btn-chico" type="submit" disabled={guardandoEdicion}>{guardandoEdicion ? '…' : '✓ Guardar'}</button>
                <button className="btn-link" type="button" onClick={cancelarEdicion}>Cancelar</button>
              </form>
            ) : seleccionable ? (
              <label>
                <input
                  type="checkbox"
                  checked={seleccionados.includes(j.id)}
                  onChange={() => alternar(j.id)}
                  disabled={!seleccionados.includes(j.id) && seleccionados.length >= maxSeleccion && !(toqueSuave && forzarMasSeleccion)}
                />
                <span className="dorsal-chip">{j.dorsal ?? '-'}</span> {j.nombre}
              </label>
            ) : (
              <span>
                <span className="dorsal-chip">{j.dorsal ?? '-'}</span> {j.nombre}
                {j.pendiente && <span className="texto-tenue" style={{ fontSize: 11 }}> (sin guardar)</span>}
                {j.temporal && <span className="texto-tenue" style={{ fontSize: 11 }}> (solo este partido)</span>}
              </span>
            )}
            {editandoId !== j.id && (permitirEditar || permitirEliminar) && (
              <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {permitirEditar && (
                  <button type="button" className="btn-link" onClick={() => iniciarEdicion(j)} title="Editar nombre/número">✏️</button>
                )}
                {permitirEliminar && (
                  <button type="button" className="btn-link" onClick={() => eliminarJugador(j)} title="Sacar de la nómina">✕</button>
                )}
              </span>
            )}
          </li>
        ))}
        {roster.length === 0 && (
          <li className="texto-tenue">Sin jugadores todavía{permitirAgregar ? ' — está bien así para un juego rápido.' : '.'}</li>
        )}
      </ul>

      {permitirAgregar && (
        alcanzoTopeFiba ? (
          <div className="mensaje-error">
            Norma FIBA: 12 jugadores por partido. <button type="button" className="btn-link" onClick={() => setForzarMasDeDoce(true)}>Agregar igual</button>
          </div>
        ) : (
          <form className="fila-form" onSubmit={agregarJugador} style={{ flexWrap: 'wrap' }}>
            <input placeholder="Dorsal" value={dorsal} onChange={(e) => setDorsal(e.target.value)} style={{ width: 80 }} />
            <input placeholder="Nombre del jugador (opcional)" value={nombreJugador} onChange={(e) => setNombreJugador(e.target.value)} />
            <button className="btn-secundario" type="submit">+ Agregar</button>
            {partidoId && (
              <label className="texto-tenue" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, width: '100%' }} title="No queda en el plantel del equipo — se usa una sola vez, solo en este partido.">
                <input type="checkbox" checked={soloEstePartido} onChange={(e) => setSoloEstePartido(e.target.checked)} />
                Solo para este partido (no lo guardes en el equipo)
              </label>
            )}
          </form>
        )
      )}
    </div>
  );
}
