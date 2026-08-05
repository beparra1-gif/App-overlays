import { useEffect, useRef, useState } from 'react';
import { api, urlLogo } from '../api/client';

// 'normal': el escudo de siempre — el que se usa en el marcador y en
// todos lados. 'fondo': una versión alternativa (blanco y negro, u otra)
// pensada específicamente para la marca de agua de Nómina — subila con el
// MISMO título que la versión normal del mismo club, y en Nómina el
// interruptor "Usar logo alternativo" la encuentra sola por ese nombre,
// sin tener que elegir nada por diseño.
const CATEGORIAS = [
  { id: 'normal', etiqueta: 'Logos', ayuda: 'Los escudos de siempre — se usan en el marcador y en todos lados.' },
  { id: 'fondo', etiqueta: 'Logos de fondo', ayuda: 'Versión alternativa (ej. blanco y negro) para la marca de agua de Nómina. Subila con el mismo título que el logo normal del club para que se emparejen solos.' },
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

  const cargar = () => api.listarLogos().then((d) => setLogos(d.logos));

  useEffect(() => { cargar(); }, []);

  const avisar = (mensaje) => {
    setExito(mensaje);
    setTimeout(() => setExito(''), 2000);
  };

  const subir = async (e) => {
    e.preventDefault();
    const archivo = inputRef.current?.files?.[0];
    if (!archivo) return;
    setError('');
    setSubiendo(true);
    try {
      await api.subirLogo(archivo, titulo.trim() || archivo.name.replace(/\.[^.]+$/, ''), categoria);
      inputRef.current.value = '';
      setTitulo('');
      cargar();
      avisar('Logo subido ✓');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async (id) => {
    await api.eliminarLogo(id);
    cargar();
    avisar('Logo eliminado ✓');
  };

  const copiarUrl = (filename) => {
    navigator.clipboard?.writeText(urlLogo(filename));
    setCopiado(filename);
    setTimeout(() => setCopiado(null), 2000);
  };

  const empezarEdicion = (logo) => {
    setEditandoId(logo.id);
    setTituloEditado(logo.nombre);
  };

  const guardarTitulo = async (id) => {
    setError('');
    try {
      await api.actualizarLogo(id, { nombre: tituloEditado.trim() });
      setEditandoId(null);
      cargar();
      avisar('Título actualizado ✓');
    } catch (err) {
      setError(err.message);
    }
  };

  const logosDeCategoria = logos.filter((l) => (l.categoria || 'normal') === categoria);
  const logosFiltrados = logosDeCategoria.filter((l) => l.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div className="pagina">
      <h1>Logos</h1>
      <p className="texto-tenue">
        Subí los logos de tus equipos acá, ponéles un título claro y después copiá la URL para pegarla en el campo de logo de
        cada equipo o diseño. Los logos originales de tu club en Centro de Cultura Física viven en la base de datos en
        producción de esa app — no son accesibles desde acá, así que hay que resubirlos.
      </p>
      {error && <p className="mensaje-error">{error}</p>}
      {exito && <p className="mensaje-exito">{exito}</p>}

      <div className="pestanas-personalizacion" style={{ marginBottom: 12 }}>
        {CATEGORIAS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`pestana-btn ${categoria === c.id ? 'activa' : ''}`}
            onClick={() => setCategoria(c.id)}
          >
            {c.etiqueta} {logos.length > 0 && `(${logos.filter((l) => (l.categoria || 'normal') === c.id).length})`}
          </button>
        ))}
      </div>
      <p className="texto-tenue" style={{ marginTop: -4 }}>{CATEGORIAS.find((c) => c.id === categoria)?.ayuda}</p>

      <form className="fila-form" onSubmit={subir}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />
        <input
          placeholder="Título (ej: Halcones - escudo principal)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn-primario" type="submit" disabled={subiendo}>
          {subiendo ? 'Subiendo…' : categoria === 'fondo' ? 'Subir logo de fondo' : 'Subir logo'}
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
            <div className="tarjeta-acciones">
              <button className="btn-secundario" onClick={() => copiarUrl(l.filename)}>
                {copiado === l.filename ? 'URL copiada ✓' : 'Copiar URL'}
              </button>
              {editandoId !== l.id && <button className="btn-secundario" onClick={() => empezarEdicion(l)}>Renombrar</button>}
              <button className="btn-link" onClick={() => eliminar(l.id)}>Eliminar</button>
            </div>
          </div>
        ))}
        {logosDeCategoria.length === 0 && (
          <p className="texto-tenue">
            {categoria === 'fondo' ? 'Todavía no subiste ningún logo de fondo.' : 'Todavía no subiste ningún logo.'}
          </p>
        )}
        {logosDeCategoria.length > 0 && logosFiltrados.length === 0 && <p className="texto-tenue">Ningún logo coincide con "{busqueda}".</p>}
      </div>
    </div>
  );
}
