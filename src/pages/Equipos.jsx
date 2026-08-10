import { useEffect, useState } from 'react';
import { api } from '../api/client';
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

  const eliminar = async (id) => {
    await api.eliminarJugador(id);
    cargar();
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
                <span className="dorsal-chip">{j.dorsal ?? '-'}</span>
                {j.nombre}
                <button className="btn-link" onClick={() => iniciarEdicion(j)}>Editar</button>
                <button className="btn-link" onClick={() => eliminar(j.id)}>Eliminar</button>
              </>
            )}
          </li>
        ))}
        {jugadores.length === 0 && <li className="texto-tenue">Sin jugadores todavía</li>}
      </ul>
    </div>
  );
}

function FilaEdicion({ equipo, logos, onLogoSubido, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(equipo.nombre);
  const [color, setColor] = useState(equipo.color);
  const [logoUrl, setLogoUrl] = useState(equipo.logo_url || '');
  const [error, setError] = useState('');

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onGuardar({ nombre: nombre.trim(), color, logo_url: logoUrl || null });
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
      await api.crearEquipo({ nombre, color, logo_url: logoUrl || null });
      setNombre('');
      setLogoUrl('');
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

  return (
    <div className="pagina">
      <h1>Equipos</h1>
      {error && <p className="mensaje-error">{error}</p>}
      {exito && <p className="mensaje-exito">{exito}</p>}
      <form className="fila-form" onSubmit={crear}>
        <input placeholder="Nombre del equipo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <SelectorLogo logos={logos} value={logoUrl} onChange={setLogoUrl} onLogoSubido={agregarLogoALista} />
        <button className="btn-primario" type="submit">Crear equipo</button>
      </form>
      {logos.length === 0 && (
        <p className="texto-tenue" style={{ marginTop: -8 }}>
          Todavía no subiste logos — podés hacerlo en la sección Logos y después elegirlos acá.
        </p>
      )}

      <div className="grilla-tarjetas">
        {equipos.filter((eq) => !eq.borrador).map((eq) => (
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
                  {eq.en_uso && <span className="chip-en-uso" title="Es el equipo que un diseño tiene puesto ahora mismo">🟢 En uso</span>}
                </div>
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
        {equipos.filter((eq) => !eq.borrador).length === 0 && <p className="texto-tenue">Todavía no creaste ningún equipo.</p>}
      </div>
      <p className="texto-tenue" style={{ marginTop: 10, fontSize: 12 }}>
        Los equipos "En uso" son los que algún diseño tiene puestos ahora mismo en "Juego en vivo" — el resto son equipos
        sueltos (de pruebas, o de partidos ya terminados) que podés editar, reusar o borrar sin que afecten nada en curso.
      </p>

      {equipoAbierto && <PanelJugadores equipo={equipoAbierto} onCerrar={() => setEquipoAbierto(null)} />}
    </div>
  );
}
