import { useMemo, useState } from 'react';
import './selectorNomina.css';

const RAMAS = [
  { value: '', label: 'Todas' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
];
const ramaTexto = (r) => (r === 'femenino' ? 'Femenino' : r === 'masculino' ? 'Masculino' : '');

// Grilla grande de nóminas guardadas con filtro rápido por categoría y rama
// (botones de un toque) más un buscador. La usan la Mesa y "Personalizar →
// Equipos" dentro de su propia ventana emergente.
export default function SelectorNomina({ equipos, onElegir, elegidoId = null }) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [rama, setRama] = useState('');

  const categorias = useMemo(() => {
    const cuenta = new Map();
    equipos.forEach((e) => { if (e.categoria) cuenta.set(e.categoria, (cuenta.get(e.categoria) || 0) + 1); });
    return [...cuenta.entries()].sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }));
  }, [equipos]);
  const hayRamas = equipos.some((e) => e.rama);

  const texto = busqueda.trim().toLowerCase();
  const lista = equipos
    .filter((e) => (!categoria || e.categoria === categoria)
      && (!rama || e.rama === rama)
      && (!texto || e.nombre.toLowerCase().includes(texto) || (e.categoria || '').toLowerCase().includes(texto)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <div className="sn">
      <input className="sn-buscar" type="search" placeholder="Buscar equipo o categoría…" value={busqueda} onChange={(ev) => setBusqueda(ev.target.value)} />
      {categorias.length > 0 && (
        <div className="sn-chips" role="group" aria-label="Filtrar por categoría">
          <button type="button" className={!categoria ? 'activo' : ''} onClick={() => setCategoria('')}>Todas <span>{equipos.length}</span></button>
          {categorias.map(([c, n]) => (
            <button key={c} type="button" className={categoria === c ? 'activo' : ''} onClick={() => setCategoria(categoria === c ? '' : c)}>{c} <span>{n}</span></button>
          ))}
        </div>
      )}
      {hayRamas && (
        <div className="sn-chips sn-chips-rama" role="group" aria-label="Filtrar por rama">
          {RAMAS.map((r) => <button key={r.value} type="button" className={rama === r.value ? 'activo' : ''} onClick={() => setRama(r.value)}>{r.label}</button>)}
        </div>
      )}
      <p className="sn-cuenta">{lista.length === 1 ? '1 nómina disponible' : `${lista.length} nóminas disponibles`}</p>
      <div className="sn-grilla">
        {lista.map((e) => (
          <button key={e.id} type="button" className={`sn-tarjeta ${elegidoId === e.id ? 'activo' : ''}`} style={{ '--sn-color': e.color || '#0a84ff' }} onClick={() => onElegir(e)}>
            <span className="sn-logo" aria-hidden="true">{e.logo_url ? <img src={e.logo_url} alt="" /> : (e.nombre || '?').charAt(0).toUpperCase()}</span>
            <span className="sn-nombre">{e.nombre}</span>
            <span className="sn-detalle">{[e.categoria, ramaTexto(e.rama)].filter(Boolean).join(' · ') || 'Sin categoría'}</span>
            <span className="sn-jugadores">{e.jugadores_count || 0} en la nómina</span>
          </button>
        ))}
        {lista.length === 0 && <p className="sn-vacio">Ninguna nómina coincide con el filtro.</p>}
      </div>
    </div>
  );
}
