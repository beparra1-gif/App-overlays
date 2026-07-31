import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Publicidad() {
  const [patrocinadores, setPatrocinadores] = useState([]);
  const [nombre, setNombre] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [duracionSegundos, setDuracionSegundos] = useState(8);
  const [error, setError] = useState('');

  const cargar = () => api.listarPatrocinadores().then((d) => setPatrocinadores(d.patrocinadores));

  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.crearPatrocinador({ nombre, imagen_url: imagenUrl, duracion_segundos: Number(duracionSegundos) || 8 });
      setNombre('');
      setImagenUrl('');
      setDuracionSegundos(8);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const alternarActivo = async (p) => {
    await api.actualizarPatrocinador(p.id, { activo: !p.activo });
    cargar();
  };

  const eliminar = async (id) => {
    await api.eliminarPatrocinador(id);
    cargar();
  };

  return (
    <div className="pagina">
      <h1>Publicidad</h1>
      <p className="texto-tenue">Los patrocinadores activos rotan en la franja inferior del marcador público, según el orden y duración configurados.</p>
      {error && <p className="mensaje-error">{error}</p>}

      <form className="fila-form" onSubmit={crear}>
        <input placeholder="Nombre del patrocinador" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <input placeholder="URL de la imagen" value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} required style={{ flex: 1 }} />
        <input
          type="number"
          min={2}
          placeholder="Segundos"
          value={duracionSegundos}
          onChange={(e) => setDuracionSegundos(e.target.value)}
          style={{ width: '90px' }}
        />
        <button className="btn-primario" type="submit">Agregar</button>
      </form>

      <div className="grilla-tarjetas">
        {patrocinadores.map((p) => (
          <div className="tarjeta" key={p.id}>
            <img src={p.imagen_url} alt={p.nombre} style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }} />
            <strong>{p.nombre}</strong>
            <p className="texto-tenue">{p.duracion_segundos}s en pantalla · {p.activo ? 'activo' : 'inactivo'}</p>
            <div className="tarjeta-acciones">
              <button className="btn-secundario" onClick={() => alternarActivo(p)}>{p.activo ? 'Desactivar' : 'Activar'}</button>
              <button className="btn-link" onClick={() => eliminar(p.id)}>Eliminar</button>
            </div>
          </div>
        ))}
        {patrocinadores.length === 0 && <p className="texto-tenue">Todavía no agregaste patrocinadores.</p>}
      </div>
    </div>
  );
}
