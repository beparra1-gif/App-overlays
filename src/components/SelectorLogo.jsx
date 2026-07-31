import { useEffect, useMemo, useRef, useState } from 'react';
import { api, urlLogo } from '../api/client';

// Buscador de logo: escribís parte del nombre ("gim") y aparecen los logos
// ya subidos que lo contienen, con miniatura — antes era un <select> con
// todos los logos en orden alfabético, incómodo de recorrer apenas había
// varios cargados. Separado a propósito del nombre del club (ese vive en el
// campo de al lado, en el formulario que usa esto): acá solo se busca/elige
// la imagen.
export default function SelectorLogo({ logos, value, onChange, onLogoSubido }) {
  const logoActual = logos.find((l) => urlLogo(l.filename) === value);
  const [busqueda, setBusqueda] = useState(logoActual?.nombre || '');
  const [abierto, setAbierto] = useState(false);
  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const archivoRef = useRef(null);
  const cajaRef = useRef(null);

  // Si el logo elegido cambia desde afuera (o se limpia), el texto del
  // buscador se sincroniza para reflejar lo que está elegido en verdad.
  useEffect(() => {
    setBusqueda(logoActual?.nombre || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const alHacerClickFuera = (e) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', alHacerClickFuera);
    return () => document.removeEventListener('mousedown', alHacerClickFuera);
  }, []);

  const coincidencias = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return logos;
    return logos.filter((l) => (l.nombre || '').toLowerCase().includes(texto));
  }, [busqueda, logos]);

  const elegir = (logo) => {
    onChange(urlLogo(logo.filename));
    setBusqueda(logo.nombre);
    setAbierto(false);
  };

  const limpiar = () => {
    onChange('');
    setBusqueda('');
    setAbierto(true);
  };

  const subir = async (e) => {
    e?.preventDefault();
    const archivo = archivoRef.current?.files?.[0];
    if (!archivo) return;
    setError('');
    setSubiendo(true);
    try {
      const { logo } = await api.subirLogo(archivo, nombreNuevo.trim() || archivo.name.replace(/\.[^.]+$/, ''));
      onChange(urlLogo(logo.filename));
      setBusqueda(logo.nombre);
      setAbierto(false);
      onLogoSubido?.(logo);
      setMostrarSubida(false);
      setNombreNuevo('');
      if (archivoRef.current) archivoRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="fila-form" style={{ margin: 0 }}>
        <div className="buscador-logo" ref={cajaRef}>
          <div className="buscador-logo-caja">
            {value && <img src={value} alt="" className="buscador-logo-preview" />}
            <input
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setAbierto(true); }}
              onFocus={() => setAbierto(true)}
              placeholder="Buscar logo por nombre…"
              style={{ flex: 1, minWidth: 140, border: 'none', padding: '6px 4px' }}
            />
            {value && <button type="button" className="btn-link" onClick={limpiar} title="Quitar logo">✕</button>}
          </div>
          {abierto && (
            <div className="buscador-logo-lista">
              {coincidencias.length === 0 && <p className="texto-tenue" style={{ margin: '8px 12px' }}>Sin resultados.</p>}
              {coincidencias.map((l) => (
                <button type="button" key={l.id} className="buscador-logo-item" onClick={() => elegir(l)}>
                  <img src={urlLogo(l.filename)} alt="" />
                  <span>{l.nombre}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn-link" onClick={() => setMostrarSubida((v) => !v)}>
          {mostrarSubida ? 'Cancelar' : '+ Subir logo nuevo'}
        </button>
      </div>
      {mostrarSubida && (
        <div className="fila-form" style={{ margin: 0 }}>
          <input ref={archivoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
          <input
            placeholder="Título del logo"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            style={{ flex: 1, minWidth: 140 }}
          />
          <button className="btn-secundario" type="button" onClick={subir} disabled={subiendo}>{subiendo ? 'Subiendo…' : 'Subir'}</button>
        </div>
      )}
      {error && <p className="mensaje-error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
