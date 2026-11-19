import { useEffect, useRef, useState } from 'react';
import { api, urlFotoJugador } from '../api/client';
import SelectorLogo from '../components/SelectorLogo';
import { parsearListaNomina } from './listaNomina';

function PanelJugadores({ equipo }) {
  const [jugadores, setJugadores] = useState([]);
  const [nombre, setNombre] = useState('');
  const [dorsal, setDorsal] = useState('');
  const [error, setError] = useState('');
  // Edición en línea de una fila ya cargada — antes solo se podía agregar o
  // borrar; un typo en el nombre o el dorsal obligaba a borrar el jugador
  // entero y cargarlo de nuevo (perdiendo sus jugadas/estadísticas ya
  // anotadas si tenía alguna en un partido).
  const [editandoId, setEditandoId] = useState(null);
  const [dorsalEdit, setDorsalEdit] = useState('');
  const [nombreEdit, setNombreEdit] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [subiendoFotoId, setSubiendoFotoId] = useState(null);
  const [importando, setImportando] = useState(null); // null = cerrado · string = texto pegado
  const [guardandoLista, setGuardandoLista] = useState(false);
  const inputFotoRef = useRef(null);
  const jugadorFotoRef = useRef(null);

  // Foto de jugador (opcional) — la usa Nómina cuando "Mostrar foto de
  // jugador" está prendido en Personalizar diseño, sobre todo para la
  // presentación del plantel titular uno por uno.
  const abrirSelectorFoto = (jugador) => {
    jugadorFotoRef.current = jugador;
    inputFotoRef.current?.click();
  };
  const subirFoto = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    const jugador = jugadorFotoRef.current;
    if (!archivo || !jugador) return;
    setError('');
    setSubiendoFotoId(jugador.id);
    try {
      await api.subirFotoJugador(jugador.id, archivo);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendoFotoId(null);
    }
  };
  const quitarFoto = async (jugador) => {
    setError('');
    setSubiendoFotoId(jugador.id);
    try {
      await api.eliminarFotoJugador(jugador.id);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendoFotoId(null);
    }
  };

  const cargar = () => api.listarJugadores(equipo.id).then((d) => setJugadores(d.jugadores)).catch((err) => setError(err.message));

  useEffect(() => { cargar(); }, [equipo.id]);

  const agregar = async (e) => {
    e.preventDefault();
    setError('');
    // A veces se carga la nómina antes de tener el nombre real de cada
    // jugadora — con el dorsal solo alcanza para identificarla, el nombre
    // se completa después con "Editar".
    if (!nombre.trim() && !dorsal.trim()) return setError('Poné al menos el dorsal o el nombre del jugador');
    try {
      await api.crearJugador(equipo.id, { nombre, dorsal: dorsal || null });
      setNombre('');
      setDorsal('');
      document.querySelector('.panel-jugadores input')?.focus();
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  // Antes borraba directo, sin preguntar nada — un toque de más en
  // "Eliminar" perdía la nómina sin aviso. Mismo criterio que EquipoRoster
  // (usado en la Mesa/"Personalizar tablero"): confirma, y si el jugador ya
  // tiene jugadas anotadas en algún partido (eventos_partido), el backend
  // lo bloquea con un 409 — ahí se pregunta de nuevo, explicando qué se
  // pierde, antes de forzarlo.
  const eliminar = async (jugador) => {
    if (!window.confirm(`¿Sacar a ${jugador.nombre || `#${jugador.dorsal}`} de la nómina? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await api.eliminarJugador(jugador.id);
      cargar();
    } catch (err) {
      if (err.data?.eventos_bloqueando) {
        const cantidad = err.data.eventos_bloqueando;
        const confirmado = window.confirm(
          `${jugador.nombre || `#${jugador.dorsal}`} ya tiene ${cantidad} jugada${cantidad === 1 ? '' : 's'} anotada${cantidad === 1 ? '' : 's'} en algún partido. ` +
          `El puntaje de esos partidos no cambia, pero se pierde el detalle de esas jugadas para este jugador. Esta acción no se puede deshacer. ¿Eliminarlo igual?`
        );
        if (!confirmado) return;
        try {
          await api.eliminarJugador(jugador.id, { forzar: true });
          cargar();
        } catch (err2) {
          setError(err2.message);
        }
        return;
      }
      setError(err.message);
    }
  };

  // Carga en orden todas las jugadoras de la lista pegada; las que ya
  // estaban (mismo dorsal o mismo nombre) se saltean.
  const importarLista = async () => {
    const lista = parsearListaNomina(importando);
    if (!lista.length) return setError('Pegá al menos una línea');
    setError('');
    setGuardandoLista(true);
    let agregadas = 0;
    try {
      for (const j of lista) {
        const repetida = jugadores.some((x) => (j.dorsal && String(x.dorsal) === j.dorsal) || (j.nombre && x.nombre?.toLowerCase() === j.nombre.toLowerCase()));
        if (repetida) continue;
        await api.crearJugador(equipo.id, { nombre: j.nombre, dorsal: j.dorsal });
        agregadas += 1;
      }
      setImportando(null);
      await cargar();
      if (agregadas < lista.length) setError(`Se agregaron ${agregadas} de ${lista.length}: las demás ya estaban en la nómina.`);
    } catch (err) {
      setError(err.message);
      cargar();
    } finally {
      setGuardandoLista(false);
    }
  };

  const iniciarEdicion = (j) => {
    setError('');
    setEditandoId(j.id);
    setDorsalEdit(j.dorsal ?? '');
    setNombreEdit(j.nombre);
  };
  const cancelarEdicion = () => setEditandoId(null);
  const guardarEdicion = async (id, e) => {
    e.preventDefault();
    const limpio = nombreEdit.trim();
    if (!limpio && !dorsalEdit.trim()) return setError('Poné al menos el dorsal o el nombre del jugador');
    setError('');
    setGuardandoEdicion(true);
    try {
      await api.actualizarJugador(id, { nombre: limpio, dorsal: dorsalEdit === '' ? null : dorsalEdit });
      setEditandoId(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  return (
    <div className="panel-jugadores">
      {error && <p className="mensaje-error">{error}</p>}
      <form className="fila-form" onSubmit={agregar}>
        <input placeholder="N°" inputMode="numeric" value={dorsal} onChange={(e) => setDorsal(e.target.value)} style={{ width: 70 }} aria-label="Dorsal" />
        <input placeholder="Nombre (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ flex: 1 }} aria-label="Nombre" />
        <button className="btn-primario" type="submit">＋ Agregar</button>
        <button className="btn-secundario" type="button" onClick={() => setImportando(importando === null ? '' : null)}>📋 Pegar lista</button>
      </form>
      {importando !== null && (
        <div className="importar-nomina">
          <span className="texto-tenue">Una jugadora por línea, con el número adelante o atrás. Ej: «7 Ana Torres», «#12 - Sofía Díaz» o copiado de Excel.</span>
          <textarea value={importando} onChange={(e) => setImportando(e.target.value)} placeholder={'4 Ana Torres\n7 Bryana Gálvez\n10 Camila Muñoz'} autoFocus />
          <div className="fila-form" style={{ margin: 0, justifyContent: 'flex-end' }}>
            <span className="texto-tenue" style={{ marginRight: 'auto' }}>{parsearListaNomina(importando).length} jugadora(s) detectada(s)</span>
            <button type="button" className="btn-secundario" onClick={() => setImportando(null)}>Cancelar</button>
            <button type="button" className="btn-primario" disabled={guardandoLista} onClick={importarLista}>{guardandoLista ? 'Cargando…' : 'Agregar a la nómina'}</button>
          </div>
        </div>
      )}
      <input ref={inputFotoRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={subirFoto} />
      <ul className="lista-jugadores">
        {jugadores.map((j) => (
          <li key={j.id}>
            {editandoId === j.id ? (
              <form className="fila-form" style={{ flex: 1, margin: 0 }} onSubmit={(e) => guardarEdicion(j.id, e)}>
                <input placeholder="Dorsal" value={dorsalEdit} onChange={(e) => setDorsalEdit(e.target.value)} style={{ width: 70 }} autoFocus />
                <input placeholder="Nombre" value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} style={{ flex: 1, minWidth: 100 }} />
                <button className="btn-secundario btn-chico" type="submit" disabled={guardandoEdicion}>{guardandoEdicion ? '…' : '✓ Guardar'}</button>
                <button className="btn-link" type="button" onClick={cancelarEdicion}>Cancelar</button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className="foto-jugador-btn"
                  onClick={() => abrirSelectorFoto(j)}
                  disabled={subiendoFotoId === j.id}
                  title={j.fotoUrl ? 'Cambiar foto' : 'Agregar foto'}
                >
                  {subiendoFotoId === j.id
                    ? '…'
                    : j.fotoUrl
                      ? <img src={urlFotoJugador(j.fotoUrl)} alt="" />
                      : '📷'}
                </button>
                <span className="dorsal-chip">{j.dorsal ?? '-'}</span>
                {j.nombre}
                {j.fotoUrl && <button className="btn-link" onClick={() => quitarFoto(j)} disabled={subiendoFotoId === j.id} title="Quitar foto">🖼️✕</button>}
                <button className="btn-link" onClick={() => iniciarEdicion(j)}>Editar</button>
                <button className="btn-link" onClick={() => eliminar(j)}>Eliminar</button>
              </>
            )}
          </li>
        ))}
        {jugadores.length === 0 && <li className="texto-tenue">Sin jugadores todavía. Cargá el dorsal y el nombre arriba (Enter agrega).</li>}
      </ul>
    </div>
  );
}

// Ventana (crear / editar equipo y nómina): sobre la página, se cierra con
// Esc o tocando afuera.
function Dialogo({ titulo, onCerrar, children, ancho = 560 }) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-label={titulo} style={{ width: `min(${ancho}px, 94vw)` }}>
        <div className="dialogo-cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="btn-link" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Formulario de equipo (el mismo para crear y editar), con etiquetas y una
// vista previa de cómo se ve el equipo.
function FormularioEquipo({ equipo, logos, onLogoSubido, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(equipo?.nombre || '');
  const [color, setColor] = useState(equipo?.color || '#0a84ff');
  const [logoUrl, setLogoUrl] = useState(equipo?.logo_url || '');
  const [categoria, setCategoria] = useState(equipo?.categoria || '');
  const [rama, setRama] = useState(equipo?.rama || '');
  const [codigo, setCodigo] = useState(equipo?.codigo || '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre es obligatorio');
    setError('');
    setGuardando(true);
    try {
      await onGuardar({ nombre: nombre.trim(), color, logo_url: logoUrl || null, categoria: categoria.trim() || null, rama: rama || null, codigo: codigo.trim() || null });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="form-equipo" onSubmit={guardar}>
      <div className="equipo-previa" style={{ '--color-equipo': color }}>
        {logoUrl ? <img src={logoUrl} alt="" /> : <span className="equipo-previa-sigla">{(codigo || nombre || '?').slice(0, 3).toUpperCase()}</span>}
        <div>
          <strong>{nombre || 'Nombre del equipo'}</strong>
          <span>{[categoria, rama === 'femenino' ? 'Femenino' : rama === 'masculino' ? 'Masculino' : null].filter(Boolean).join(' · ') || 'Sin categoría'}</span>
        </div>
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Halcones" autoFocus required /></label>
      <div className="form-equipo-fila">
        <label className="form-equipo-color">Color
          <span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /><code>{color.toUpperCase()}</code></span>
        </label>
        <label>Código (opcional)
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 4))} placeholder="Ej: HAL" title="Sigla corta que usan algunos tableros (si no, toman las 3 primeras letras del nombre)" />
        </label>
      </div>
      <label>Escudo
        <SelectorLogo categoria="normal" logos={logos} value={logoUrl} onChange={setLogoUrl} onLogoSubido={onLogoSubido} />
      </label>
      <div className="form-equipo-fila">
        <label>Categoría (opcional)<input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ej: Sub-15, Primera" /></label>
        <label>Rama
          <span className="segmentado segmentado-ancho">
            {[{ id: '', etiqueta: 'Sin rama' }, { id: 'femenino', etiqueta: 'Femenino' }, { id: 'masculino', etiqueta: 'Masculino' }].map((o) => (
              <button key={o.id || 'ninguna'} type="button" className={rama === o.id ? 'activo' : ''} onClick={() => setRama(o.id)}>{o.etiqueta}</button>
            ))}
          </span>
        </label>
      </div>
      <div className="form-equipo-acciones">
        <button type="button" className="btn-secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : equipo ? 'Guardar cambios' : 'Crear equipo'}</button>
      </div>
    </form>
  );
}

export default function Equipos() {
  const [equipos, setEquipos] = useState([]);
  const [logos, setLogos] = useState([]);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [equipoAbierto, setEquipoAbierto] = useState(null);
  // null = sin ventana · 'nuevo' = crear · objeto = editar ese equipo
  const [editando, setEditando] = useState(null);

  const cargar = () => Promise.all([
    api.listarEquipos().then((d) => setEquipos(d.equipos)),
    api.listarLogos().then((d) => setLogos(d.logos)),
  ]).catch((err) => setError(err.message));

  useEffect(() => { cargar(); }, []);

  const avisar = (mensaje) => {
    setExito(mensaje);
    setTimeout(() => setExito(''), 2500);
  };

  const guardar = async (payload) => {
    if (editando === 'nuevo') await api.crearEquipo(payload);
    else await api.actualizarEquipo(editando.id, payload);
    const fueNuevo = editando === 'nuevo';
    setEditando(null);
    await cargar();
    avisar(fueNuevo ? 'Equipo creado ✓' : 'Equipo actualizado ✓');
  };

  // Siempre pregunta antes de borrar. Si el equipo tiene partidos, el
  // backend avisa CUÁNTOS y se pregunta de nuevo explicando qué se pierde.
  const eliminar = async (equipo) => {
    if (!window.confirm(`¿Eliminar "${equipo.nombre}" y su nómina? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await api.eliminarEquipo(equipo.id);
      await cargar();
      avisar('Equipo eliminado ✓');
    } catch (err) {
      if (err.data?.partidos_bloqueando) {
        const cantidad = err.data.partidos_bloqueando;
        const confirmado = window.confirm(
          `"${equipo.nombre}" tiene ${cantidad} partido${cantidad === 1 ? '' : 's'} asociado${cantidad === 1 ? '' : 's'}, cada uno con su propio enlace de OBS. ` +
          'Si los eliminás junto con el equipo, esos enlaces dejan de funcionar. ¿Eliminar el equipo Y esos partidos?'
        );
        if (!confirmado) return;
        try {
          await api.eliminarEquipo(equipo.id, { forzar: true });
          await cargar();
          avisar('Equipo y partidos asociados eliminados ✓');
        } catch (err2) {
          setError(err2.message);
        }
        return;
      }
      setError(err.message);
    }
  };

  const agregarLogoALista = (logo) => setLogos((prev) => [logo, ...prev]);

  // Una sola grilla: por nombre (un club con varias categorías/ramas queda
  // junto), después rama y categoría. La búsqueda mira nombre, categoría y código.
  const ORDEN_RAMA = { femenino: 0, masculino: 1 };
  const texto = busqueda.trim().toLowerCase();
  const visibles = equipos
    .filter((eq) => !eq.borrador)
    .filter((eq) => !texto || [eq.nombre, eq.categoria, eq.codigo, eq.rama].some((v) => (v || '').toLowerCase().includes(texto)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre) || ((ORDEN_RAMA[a.rama] ?? 2) - (ORDEN_RAMA[b.rama] ?? 2)) || (a.categoria || '').localeCompare(b.categoria || ''));
  const total = equipos.filter((eq) => !eq.borrador).length;

  return (
    <div className="pagina">
      <div className="equipos-cabecera">
        <div>
          <h1>Equipos</h1>
          <p className="texto-tenue" style={{ margin: 0 }}>{total} equipo{total === 1 ? '' : 's'} · nombre, colores, escudo, categoría y nómina de cada uno.</p>
        </div>
        <div className="equipos-cabecera-acciones">
          {total > 0 && <input type="search" placeholder="🔍 Buscar equipo, categoría o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />}
          <button className="btn-primario" onClick={() => setEditando('nuevo')}>＋ Nuevo equipo</button>
        </div>
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      {exito && <p className="mensaje-exito">{exito}</p>}

      {visibles.length > 0 && (
          <div className="grilla-tarjetas">
            {visibles.map((eq) => (
              <div className="tarjeta tarjeta-equipo" key={eq.id} style={{ '--color-equipo': eq.color }}>
                <div className="tarjeta-equipo-cabeza">
                  {eq.logo_url
                    ? <img src={eq.logo_url} alt="" />
                    : <span className="equipo-previa-sigla">{(eq.codigo || eq.nombre).slice(0, 3).toUpperCase()}</span>}
                  <div className="tarjeta-equipo-titulo">
                    <strong title={eq.nombre}>{eq.nombre}</strong>
                    <span className="tarjeta-equipo-chips">
                      {eq.categoria && <span className="chip-dato">{eq.categoria}</span>}
                      {eq.rama && <span className="chip-dato">{eq.rama === 'femenino' ? 'Femenino' : 'Masculino'}</span>}
                      {eq.codigo && <span className="chip-dato" title="Código corto para los tableros">{eq.codigo}</span>}
                      {eq.en_uso && <span className="chip-en-uso" title="Es el equipo que un diseño tiene puesto ahora mismo">● En uso</span>}
                    </span>
                  </div>
                </div>
                <p className="texto-tenue" style={{ margin: 0 }}>👥 {eq.jugadores_count} jugador{Number(eq.jugadores_count) === 1 ? '' : 'es'}</p>
                <div className="tarjeta-acciones">
                  <button className="btn-secundario btn-chico" onClick={() => setEquipoAbierto(eq)}>👥 Nómina</button>
                  <button className="btn-secundario btn-chico" onClick={() => setEditando(eq)}>✎ Editar</button>
                  {eq.en_uso
                    ? <span className="texto-tenue" style={{ fontSize: 12 }} title="No se puede borrar mientras un diseño lo tenga en uso">En uso: no se puede borrar</span>
                    : <button className="btn-link btn-peligro-link" onClick={() => eliminar(eq)}>🗑 Eliminar</button>}
                </div>
              </div>
            ))}
          </div>
      )}
      {total === 0 && (
        <div className="tarjeta" style={{ textAlign: 'center', padding: 28 }}>
          <p style={{ margin: '0 0 10px' }}>Todavía no creaste ningún equipo.</p>
          <button className="btn-primario" onClick={() => setEditando('nuevo')}>＋ Crear el primero</button>
        </div>
      )}
      {total > 0 && visibles.length === 0 && <p className="texto-tenue">Ningún equipo coincide con "{busqueda}".</p>}

      {editando && (
        <Dialogo titulo={editando === 'nuevo' ? 'Nuevo equipo' : `Editar ${editando.nombre}`} onCerrar={() => setEditando(null)}>
          <FormularioEquipo
            equipo={editando === 'nuevo' ? null : editando}
            logos={logos}
            onLogoSubido={agregarLogoALista}
            onGuardar={guardar}
            onCancelar={() => setEditando(null)}
          />
        </Dialogo>
      )}
      {equipoAbierto && (
        <Dialogo titulo={`Nómina · ${equipoAbierto.nombre}`} onCerrar={() => { setEquipoAbierto(null); cargar(); }} ancho={640}>
          <PanelJugadores equipo={equipoAbierto} />
        </Dialogo>
      )}
    </div>
  );
}
