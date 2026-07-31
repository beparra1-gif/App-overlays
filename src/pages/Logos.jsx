import { useEffect, useRef, useState } from 'react';
import { api, urlLogo } from '../api/client';

export default function Logos() {
  const [logos, setLogos] = useState([]);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [copiado, setCopiado] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [tituloEditado, setTituloEditado] = useState('');
  const inputRef = useRef(null);

  const cargar = () => api.listarLogos().then((d) => setLogos(d.logos));

  useEffect(() => { cargar(); }, []);

  const subir = async (e) => {
    e.preventDefault();
    const archivo = inputRef.current?.files?.[0];
    if (!archivo) return;
    setError('');
    setSubiendo(true);
    try {
      await api.subirLogo(archivo, titulo.trim() || archivo.name.replace(/\.[^.]+$/, ''));
      inputRef.current.value = '';
      setTitulo('');
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async (id) => {
    await api.eliminarLogo(id);
    cargar();
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
    } catch (err) {
      setError(err.message);
    }
  };

  const logosFiltrados = logos.filter((l) => l.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div className="pagina">
      <h1>Logos</h1>
      <p className="texto-tenue">
        Subí los logos de tus equipos acá, ponéles un título claro y después copiá la URL para pegarla en el campo de logo de
        cada equipo o diseño. Los logos originales de tu club en Centro de Cultura Física viven en la base de datos en
        producción de esa app — no son accesibles desde acá, así que hay que resubirlos.
      </p>
      {error && <p className="mensaje-error">{error}</p>}

      <form className="fila-form" onSubmit={subir}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />
        <input
          placeholder="Título (ej: Halcones - escudo principal)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn-primario" type="submit" disabled={subiendo}>{subiendo ? 'Subiendo…' : 'Subir logo'}</button>
      </form>

      {logos.length > 0 && (
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
        {logos.length === 0 && <p className="texto-tenue">Todavía no subiste ningún logo.</p>}
        {logos.length > 0 && logosFiltrados.length === 0 && <p className="texto-tenue">Ningún logo coincide con "{busqueda}".</p>}
      </div>
    </div>
  );
}
