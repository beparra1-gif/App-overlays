import { useEffect, useState } from 'react';
import { api } from '../api/client';
import SelectorLogo from '../components/SelectorLogo';

function PanelJugadores({ equipo, onCerrar }) {
  const [jugadores, setJugadores] = useState([]);
  const [nombre, setNombre] = useState('');
  const [dorsal, setDorsal] = useState('');
  const [error, setError] = useState('');

  const cargar = () => api.listarJugadores(equipo.id).then((d) => setJugadores(d.jugadores));

  useEffect(() => { cargar(); }, [equipo.id]);

  const agregar = async (e) => {
    e.preventDefault();
    setError('');
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

  return (
    <div className="panel-jugadores">
      <div className="panel-jugadores-header">
        <h3>Nómina — {equipo.nombre}</h3>
        <button className="btn-secundario" onClick={onCerrar}>Cerrar</button>
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      <form className="fila-form" onSubmit={agregar}>
        <input placeholder="Dorsal" value={dorsal} onChange={(e) => setDorsal(e.target.value)} style={{ width: '80px' }} />
        <input placeholder="Nombre del jugador" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <button className="btn-primario" type="submit">Agregar</button>
      </form>
      <ul className="lista-jugadores">
        {jugadores.map((j) => (
          <li key={j.id}>
            <span className="dorsal-chip">{j.dorsal ?? '-'}</span>
            {j.nombre}
            <button className="btn-link" onClick={() => eliminar(j.id)}>Eliminar</button>
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
  const [equipoAbierto, setEquipoAbierto] = useState(null);
  const [editandoId, setEditandoId] = useState(null);

  const cargar = () => {
    api.listarEquipos().then((d) => setEquipos(d.equipos));
    api.listarLogos().then((d) => setLogos(d.logos));
  };

  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.crearEquipo({ nombre, color, logo_url: logoUrl || null });
      setNombre('');
      setLogoUrl('');
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const guardarEdicion = async (id, payload) => {
    await api.actualizarEquipo(id, payload);
    setEditandoId(null);
    cargar();
  };

  // Un equipo "en uso" (el que algún diseño tiene puesto como su partido
  // activo) no se puede borrar — el partido lo sigue necesitando (la base
  // ya lo impide con una FK, así que ni se ofrece el botón para no toparse
  // con el error de golpe).
  const eliminar = async (equipo) => {
    try {
      await api.eliminarEquipo(equipo.id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const agregarLogoALista = (logo) => setLogos((prev) => [logo, ...prev]);

  return (
    <div className="pagina">
      <h1>Equipos</h1>
      {error && <p className="mensaje-error">{error}</p>}
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
        {equipos.map((eq) => (
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
        {equipos.length === 0 && <p className="texto-tenue">Todavía no creaste ningún equipo.</p>}
      </div>
      <p className="texto-tenue" style={{ marginTop: 10, fontSize: 12 }}>
        Los equipos "En uso" son los que algún diseño tiene puestos ahora mismo en "Juego en vivo" — el resto son equipos
        sueltos (de pruebas, o de partidos ya terminados) que podés editar, reusar o borrar sin que afecten nada en curso.
      </p>

      {equipoAbierto && <PanelJugadores equipo={equipoAbierto} onCerrar={() => setEquipoAbierto(null)} />}
    </div>
  );
}
