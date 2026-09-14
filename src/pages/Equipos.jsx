import { useEffect, useRef, useState } from 'react';
import { api, urlFotoJugador } from '../api/client';
import SelectorLogo from '../components/SelectorLogo';

function PanelJugadores({ equipo, onCerrar }) {
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

  const cargar = () => api.listarJugadores(equipo.id).then((d) => setJugadores(d.jugadores));

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
      <div className="panel-jugadores-header">
        <h3>Nómina — {equipo.nombre}</h3>
        <button className="btn-secundario" onClick={onCerrar}>Cerrar</button>
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      <form className="fila-form" onSubmit={agregar}>
        <input placeholder="Dorsal" value={dorsal} onChange={(e) => setDorsal(e.target.value)} style={{ width: '80px' }} />
        <input placeholder="Nombre del jugador (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="btn-primario" type="submit">Agregar</button>
      </form>
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
        {jugadores.length === 0 && <li className="texto-tenue">Sin jugadores todavía</li>}
      </ul>
    </div>
  );
}

// Categoría (Sub-15, Primera, etc.) y rama (femenino/masculino) son datos
// PROPIOS del equipo — se cargan y se ven acá, en la tarjeta de "Equipos",
// pero nunca viajan a los selectores de "elegir equipo" que usan la Mesa de
// control o el reinicio de partido: ahí solo se muestra el nombre (ver
// SelectorEquipoReinicio en Mesa.jsx y el desplegable de EquipoFicha.jsx).
function CamposCategoriaRama({ categoria, rama, onCambiarCategoria, onCambiarRama }) {
  return (
    <>
      <input
        placeholder="Categoría (opcional, ej. Sub-15)"
        value={categoria}
        onChange={(e) => onCambiarCategoria(e.target.value)}
        style={{ maxWidth: 180 }}
      />
      <select value={rama} onChange={(e) => onCambiarRama(e.target.value)} style={{ maxWidth: 150 }}>
        <option value="">Rama (opcional)</option>
        <option value="femenino">Femenino</option>
        <option value="masculino">Masculino</option>
      </select>
    </>
  );
}

// Identificador corto (ej. "CHI", "USA") — opcional, solo lo usan algunas
// plantillas de marcador tipo transmisión (FIBA Broadcast) que necesitan
// pocas letras en vez del nombre completo. El backend ya lo limpia
// (mayúsculas, solo letras/números, 4 caracteres) — acá alcanza con topar
// la escritura en el mismo largo para que el campo no "salte" al guardar.
function CampoCodigo({ codigo, onCambiar }) {
  return (
    <input
      placeholder="Código (opcional, ej. CHI)"
      value={codigo}
      onChange={(e) => onCambiar(e.target.value.toUpperCase().slice(0, 4))}
      style={{ maxWidth: 130 }}
      title="Identificador corto para plantillas de marcador tipo transmisión (ej. FIBA Broadcast) — sin cargarlo, esas plantillas muestran el nombre completo"
    />
  );
}

function FilaEdicion({ equipo, logos, onLogoSubido, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(equipo.nombre);
  const [color, setColor] = useState(equipo.color);
  const [logoUrl, setLogoUrl] = useState(equipo.logo_url || '');
  const [categoria, setCategoria] = useState(equipo.categoria || '');
  const [rama, setRama] = useState(equipo.rama || '');
  const [codigo, setCodigo] = useState(equipo.codigo || '');
  const [error, setError] = useState('');

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onGuardar({ nombre: nombre.trim(), color, logo_url: logoUrl || null, categoria: categoria.trim() || null, rama: rama || null, codigo: codigo.trim() || null });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="fila-form" onSubmit={guardar} style={{ flexWrap: 'wrap' }}>
      {error && <p className="mensaje-error" style={{ width: '100%' }}>{error}</p>}
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      <SelectorLogo logos={logos} value={logoUrl} onChange={setLogoUrl} onLogoSubido={onLogoSubido} />
      <CamposCategoriaRama categoria={categoria} rama={rama} onCambiarCategoria={setCategoria} onCambiarRama={setRama} />
      <CampoCodigo codigo={codigo} onCambiar={setCodigo} />
      <button className="btn-primario" type="submit">Guardar</button>
      <button className="btn-secundario" type="button" onClick={onCancelar}>Cancelar</button>
    </form>
  );
}

export default function Equipos() {
  const [equipos, setEquipos] = useState([]);
  const [logos, setLogos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#0a84ff');
  const [logoUrl, setLogoUrl] = useState('');
  const [categoria, setCategoria] = useState('');
  const [rama, setRama] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [equipoAbierto, setEquipoAbierto] = useState(null);
  const [editandoId, setEditandoId] = useState(null);

  const cargar = () => {
    api.listarEquipos().then((d) => setEquipos(d.equipos));
    api.listarLogos().then((d) => setLogos(d.logos));
  };

  useEffect(() => { cargar(); }, []);

  const avisar = (mensaje) => {
    setExito(mensaje);
    setTimeout(() => setExito(''), 2000);
  };

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.crearEquipo({ nombre, color, logo_url: logoUrl || null, categoria: categoria.trim() || null, rama: rama || null, codigo: codigo.trim() || null });
      setNombre('');
      setLogoUrl('');
      setCategoria('');
      setRama('');
      setCodigo('');
      cargar();
      avisar('Equipo creado ✓');
    } catch (err) {
      setError(err.message);
    }
  };

  const guardarEdicion = async (id, payload) => {
    await api.actualizarEquipo(id, payload);
    setEditandoId(null);
    cargar();
    avisar('Equipo actualizado ✓');
  };

  // Un equipo "en uso" (el que algún diseño tiene puesto como su partido
  // activo) no se puede borrar — el partido lo sigue necesitando (la base
  // ya lo impide con una FK, así que ni se ofrece el botón para no toparse
  // con el error de golpe).
  const eliminar = async (equipo) => {
    try {
      await api.eliminarEquipo(equipo.id);
      cargar();
      avisar('Equipo eliminado ✓');
    } catch (err) {
      // El backend avisa CUÁNTOS partidos lo tienen asociado (ver
      // DELETE /equipos/:id) — antes esto era un callejón sin salida: el
      // error decía "verificá que no tenga partidos asociados" pero no había
      // ningún lugar en la app para ver o borrar esos partidos viejos.
      if (err.data?.partidos_bloqueando) {
        const cantidad = err.data.partidos_bloqueando;
        const confirmado = window.confirm(
          `"${equipo.nombre}" tiene ${cantidad} partido${cantidad === 1 ? '' : 's'} asociado${cantidad === 1 ? '' : 's'}, cada uno con su propio enlace de OBS. ` +
          `Si los eliminás junto con el equipo, esos enlaces dejan de funcionar. Esta acción no se puede deshacer. ¿Eliminar el equipo Y esos partidos?`
        );
        if (!confirmado) return;
        try {
          await api.eliminarEquipo(equipo.id, { forzar: true });
          cargar();
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

  // Agrupa por NOMBRE de equipo y adentro ordena por rama — un club con
  // varias categorías/ramas ("Cultura Sub-15 Femenino", "Cultura Sub-17
  // Masculino", etc., todas con el mismo nombre) antes aparecían salteadas
  // por toda la grilla en el orden que tocara; ahora quedan todas juntas
  // bajo un mismo título, separadas por rama adentro.
  const ORDEN_RAMA = { femenino: 0, masculino: 1 };
  const gruposEquipos = (() => {
    const porNombre = new Map();
    for (const eq of equipos.filter((eq) => !eq.borrador)) {
      const clave = eq.nombre.trim().toLowerCase();
      if (!porNombre.has(clave)) porNombre.set(clave, { nombre: eq.nombre, equipos: [] });
      porNombre.get(clave).equipos.push(eq);
    }
    return [...porNombre.values()]
      .map((grupo) => ({
        ...grupo,
        equipos: [...grupo.equipos].sort((a, b) => {
          const ramaA = ORDEN_RAMA[a.rama] ?? 2;
          const ramaB = ORDEN_RAMA[b.rama] ?? 2;
          if (ramaA !== ramaB) return ramaA - ramaB;
          return (a.categoria || '').localeCompare(b.categoria || '');
        }),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  })();

  return (
    <div className="pagina">
      <h1>Equipos</h1>
      {error && <p className="mensaje-error">{error}</p>}
      {exito && <p className="mensaje-exito">{exito}</p>}
      <form className="fila-form" onSubmit={crear}>
        <input placeholder="Nombre del equipo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <SelectorLogo logos={logos} value={logoUrl} onChange={setLogoUrl} onLogoSubido={agregarLogoALista} />
        <CamposCategoriaRama categoria={categoria} rama={rama} onCambiarCategoria={setCategoria} onCambiarRama={setRama} />
        <CampoCodigo codigo={codigo} onCambiar={setCodigo} />
        <button className="btn-primario" type="submit">Crear equipo</button>
      </form>
      {logos.length === 0 && (
        <p className="texto-tenue" style={{ marginTop: -8 }}>
          Todavía no subiste logos — podés hacerlo en la sección Logos y después elegirlos acá.
        </p>
      )}

      {gruposEquipos.map((grupo) => (
        <div key={grupo.nombre.toLowerCase()} className="grupo-equipos">
          <h3 className="grupo-equipos-titulo">{grupo.nombre}</h3>
          <div className="grilla-tarjetas">
            {grupo.equipos.map((eq) => (
              <div className="tarjeta" key={eq.id} style={{ borderColor: eq.color }}>
                {editandoId === eq.id ? (
                  <FilaEdicion
                    equipo={eq}
                    logos={logos}
                    onLogoSubido={agregarLogoALista}
                    onGuardar={(payload) => guardarEdicion(eq.id, payload)}
                    onCancelar={() => setEditandoId(null)}
                  />
                ) : (
                  <>
                    <div className="tarjeta-header">
                      {eq.logo_url
                        ? <img src={eq.logo_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                        : <span className="chip-color" style={{ background: eq.color }} />}
                      <strong>{eq.nombre}</strong>
                      {eq.codigo && (
                        <span
                          title="Código corto (usado por plantillas de marcador tipo transmisión, ej. FIBA Broadcast)"
                          style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', color: 'var(--texto-tenue)', border: '1px solid var(--borde)', borderRadius: 999, padding: '2px 8px' }}
                        >
                          {eq.codigo}
                        </span>
                      )}
                      {eq.en_uso && <span className="chip-en-uso" title="Es el equipo que un diseño tiene puesto ahora mismo">🟢 En uso</span>}
                    </div>
                    {(eq.categoria || eq.rama) && (
                      <p className="texto-tenue" style={{ fontSize: 12, margin: '2px 0' }}>
                        {[eq.categoria, eq.rama === 'femenino' ? 'Femenino' : eq.rama === 'masculino' ? 'Masculino' : null].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="texto-tenue">{eq.jugadores_count} jugador(es)</p>
                    <div className="tarjeta-acciones">
                      <button className="btn-secundario" onClick={() => setEquipoAbierto(eq)}>Nómina</button>
                      <button className="btn-secundario" onClick={() => setEditandoId(eq.id)}>Editar</button>
                      {eq.en_uso ? (
                        <span className="texto-tenue" title="No se puede borrar mientras un diseño lo tenga en uso">Eliminar</span>
                      ) : (
                        <button className="btn-link" onClick={() => eliminar(eq)}>Eliminar</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {gruposEquipos.length === 0 && <p className="texto-tenue">Todavía no creaste ningún equipo.</p>}
      <p className="texto-tenue" style={{ marginTop: 10, fontSize: 12 }}>
        Los equipos "En uso" son los que algún diseño tiene puestos ahora mismo en "Juego en vivo" — el resto son equipos
        sueltos (de pruebas, o de partidos ya terminados) que podés editar, reusar o borrar sin que afecten nada en curso.
      </p>

      {equipoAbierto && <PanelJugadores equipo={equipoAbierto} onCerrar={() => setEquipoAbierto(null)} />}
    </div>
  );
}
