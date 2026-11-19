import { useEffect, useRef, useState } from 'react';
import { api, urlLogo } from '../api/client';

// Tres apartados: escudos de clubes (los de cada equipo), logos de
// competiciones (torneos/ligas, los que se agregan a los tableros desde
// Personalizar → Logos libres) y logos de fondo (versión alternativa de un
// club para la marca de agua de la Nómina: con el MISMO título que su escudo
// normal se emparejan solos).
const CATEGORIAS_LOGO = [
  { id: 'normal', etiqueta: 'Clubes', icono: '🛡️', singular: 'escudo de club', ayuda: 'Los escudos de cada equipo: se eligen en Equipos y aparecen en el marcador, la nómina y las estadísticas.' },
  { id: 'competicion', etiqueta: 'Competiciones', icono: '🏆', singular: 'logo de competición', ayuda: 'Logos de torneos y ligas: se agregan a los tableros desde Personalizar → Logos libres (y el diseño "Escudo del Torneo" usa el primero).' },
  { id: 'fondo', etiqueta: 'Fondos', icono: '🖼️', singular: 'logo de fondo', ayuda: 'Versión alternativa (ej. blanco y negro) para la marca de agua de la Nómina. Subila con el mismo título que el escudo del club para que se emparejen solos.' },
];

export default function Logos() {
  const [logos, setLogos] = useState([]);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [copiado, setCopiado] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [tituloEditado, setTituloEditado] = useState('');
  const [categoria, setCategoria] = useState('normal');
  const inputRef = useRef(null);

  const cargar = () => api.listarLogos().then((d) => setLogos(d.logos)).catch((err) => setError(err.message));

  useEffect(() => { cargar(); }, []);

  const avisar = (mensaje) => {
    setExito(mensaje);
    setTimeout(() => setExito(''), 2000);
  };

  // Cualquier acción: muestra el error en vez de fallar en silencio.
  const intentar = async (accion, mensaje) => {
    setError('');
    try {
      await accion();
      await cargar();
      avisar(mensaje);
    } catch (err) {
      setError(err.message);
    }
  };

  const subir = async (e) => {
    e.preventDefault();
    const archivo = inputRef.current?.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    await intentar(async () => {
      await api.subirLogo(archivo, titulo.trim() || archivo.name.replace(/\.[^.]+$/, ''), categoria);
      inputRef.current.value = '';
      setTitulo('');
    }, 'Logo subido ✓');
    setSubiendo(false);
  };

  const eliminar = (logo) => {
    if (!window.confirm(`¿Eliminar "${logo.nombre}"? Los equipos o tableros que lo usen se quedan sin esa imagen.`)) return;
    intentar(() => api.eliminarLogo(logo.id), 'Logo eliminado ✓');
  };

  const mover = (logo, nueva) => intentar(
    () => api.actualizarLogo(logo.id, { categoria: nueva }),
    `Movido a ${CATEGORIAS_LOGO.find((c) => c.id === nueva)?.etiqueta} ✓`,
  );

  const copiarUrl = (filename) => {
    navigator.clipboard?.writeText(urlLogo(filename));
    setCopiado(filename);
    setTimeout(() => setCopiado(null), 2000);
  };

  const guardarTitulo = (id) => intentar(async () => {
    await api.actualizarLogo(id, { nombre: tituloEditado.trim() });
    setEditandoId(null);
  }, 'Título actualizado ✓');

  const actual = CATEGORIAS_LOGO.find((c) => c.id === categoria);
  const logosDeCategoria = logos.filter((l) => (l.categoria || 'normal') === categoria);
  const logosFiltrados = logosDeCategoria.filter((l) => l.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div className="pagina">
      <h1>Logos</h1>
      <p className="texto-tenue">Separados por tipo: escudos de clubes, logos de competiciones y versiones de fondo. Un logo se puede mover de apartado cuando quieras.</p>
      {error && <p className="mensaje-error">{error}</p>}
      {exito && <p className="mensaje-exito">{exito}</p>}

      <div className="pestanas-personalizacion" style={{ marginBottom: 12 }}>
        {CATEGORIAS_LOGO.map((c) => (
          <button key={c.id} type="button" className={`pestana-btn ${categoria === c.id ? 'activa' : ''}`} onClick={() => { setCategoria(c.id); setBusqueda(''); }}>
            {c.icono} {c.etiqueta} ({logos.filter((l) => (l.categoria || 'normal') === c.id).length})
          </button>
        ))}
      </div>
      <p className="texto-tenue" style={{ marginTop: -4 }}>{actual.ayuda}</p>

      <form className="fila-form" onSubmit={subir}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />
        <input
          placeholder={categoria === 'competicion' ? 'Título (ej: Liga Metropolitana 2026)' : 'Título (ej: Halcones)'}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn-primario" type="submit" disabled={subiendo}>
          {subiendo ? 'Subiendo…' : `Subir ${actual.singular}`}
        </button>
      </form>

      {logosDeCategoria.length > 0 && (
        <input
          placeholder="🔍 Buscar por título…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ marginBottom: 16, width: '100%', maxWidth: 320 }}
        />
      )}

      <div className="grilla-tarjetas">
        {logosFiltrados.map((l) => (
          <div className="tarjeta" key={l.id}>
            <img src={urlLogo(l.filename)} alt={l.nombre} style={{ maxWidth: '100%', maxHeight: '90px', objectFit: 'contain' }} />
            {editandoId === l.id ? (
              <div className="fila-form" style={{ marginBottom: 0 }}>
                <input value={tituloEditado} onChange={(e) => setTituloEditado(e.target.value)} style={{ flex: 1 }} autoFocus />
                <button className="btn-secundario" onClick={() => guardarTitulo(l.id)}>Guardar</button>
                <button className="btn-link" onClick={() => setEditandoId(null)}>Cancelar</button>
              </div>
            ) : (
              <strong>{l.nombre}</strong>
            )}
            <label style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
              Apartado
              <select value={l.categoria || 'normal'} onChange={(e) => mover(l, e.target.value)}>
                {CATEGORIAS_LOGO.map((c) => <option key={c.id} value={c.id}>{c.icono} {c.etiqueta}</option>)}
              </select>
            </label>
            <div className="tarjeta-acciones">
              <button className="btn-secundario" onClick={() => copiarUrl(l.filename)}>
                {copiado === l.filename ? 'URL copiada ✓' : 'Copiar URL'}
              </button>
              {editandoId !== l.id && <button className="btn-secundario" onClick={() => { setEditandoId(l.id); setTituloEditado(l.nombre); }}>Renombrar</button>}
              <button className="btn-link btn-peligro-link" onClick={() => eliminar(l)}>Eliminar</button>
            </div>
          </div>
        ))}
        {logosDeCategoria.length === 0 && <p className="texto-tenue">Todavía no hay ningún {actual.singular}. Subí uno arriba o mové uno desde otro apartado.</p>}
        {logosDeCategoria.length > 0 && logosFiltrados.length === 0 && <p className="texto-tenue">Ningún logo coincide con "{busqueda}".</p>}
      </div>
    </div>
  );
}
