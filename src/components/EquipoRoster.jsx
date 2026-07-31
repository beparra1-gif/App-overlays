import { useState } from 'react';
import { api } from '../api/client';

const MAX_QUINTETO = 5;
const MAX_FIBA = 12;

// Nómina (dorsal + nombre, tope blando FIBA de 12) y/o selección de quinteto
// en cancha — las dos cosas comparten la misma lista de jugadores, pero se
// usan en dos lugares distintos con propósitos distintos:
//  - Personalizar tablero → Equipos: `seleccionable={false}` — acá solo se
//    carga el plantel completo, el quinteto se elige después.
//  - Mesa de control: `permitirAgregar={false}` — acá el plantel ya está
//    armado, esto es solo para marcar quién arranca en cancha (se puede
//    volver a abrir en cualquier momento, p. ej. al empezar cada cuarto).
export default function EquipoRoster({
  equipo,
  roster,
  seleccionados = [],
  onCambiarQuinteto,
  onJugadorAgregado,
  // Quién persiste la fila nueva (o no): por defecto la guarda YA en el
  // equipo real (comportamiento de siempre, el que usa la Mesa de control
  // en un partido en curso — ahí SÍ tiene que quedar guardada al toque para
  // que sincronice con la transmisión). "Personalizar tablero → Equipos"
  // pasa su propia versión que NO pega contra el backend — solo arma la
  // lista en memoria hasta que el usuario decide guardarla de verdad.
  onAgregarJugador,
  seleccionable = true,
  permitirAgregar = true,
}) {
  const [dorsal, setDorsal] = useState('');
  const [nombreJugador, setNombreJugador] = useState('');
  const [forzarMasDeDoce, setForzarMasDeDoce] = useState(false);
  const [error, setError] = useState('');

  const alternar = (jugadorId) => {
    if (!seleccionable) return;
    const yaEsta = seleccionados.includes(jugadorId);
    if (yaEsta) return onCambiarQuinteto(seleccionados.filter((id) => id !== jugadorId));
    if (seleccionados.length >= MAX_QUINTETO) return;
    onCambiarQuinteto([...seleccionados, jugadorId]);
  };

  const agregarJugador = async (e) => {
    e.preventDefault();
    setError('');
    if (!nombreJugador.trim()) return setError('Ponele nombre al jugador');
    try {
      const datos = { nombre: nombreJugador.trim(), dorsal: dorsal || null };
      const jugador = onAgregarJugador
        ? await onAgregarJugador(datos)
        : (await api.crearJugador(equipo.id, datos)).jugador;
      onJugadorAgregado(jugador);
      setDorsal('');
      setNombreJugador('');
    } catch (err) {
      setError(err.message);
    }
  };

  const alcanzoTopeFiba = roster.length >= MAX_FIBA && !forzarMasDeDoce;

  return (
    <div className="tarjeta">
      <h3>
        {equipo.nombre}
        {seleccionable && <span className="texto-tenue"> — quinteto {seleccionados.length}/{MAX_QUINTETO}</span>}
      </h3>
      {error && <p className="mensaje-error">{error}</p>}
      <ul className="lista-seleccion">
        {roster.map((j) => (
          <li key={j.id}>
            {seleccionable ? (
              <label>
                <input
                  type="checkbox"
                  checked={seleccionados.includes(j.id)}
                  onChange={() => alternar(j.id)}
                  disabled={!seleccionados.includes(j.id) && seleccionados.length >= MAX_QUINTETO}
                />
                <span className="dorsal-chip">{j.dorsal ?? '-'}</span> {j.nombre}
              </label>
            ) : (
              <span>
                <span className="dorsal-chip">{j.dorsal ?? '-'}</span> {j.nombre}
                {j.pendiente && <span className="texto-tenue" style={{ fontSize: 11 }}> (sin guardar)</span>}
              </span>
            )}
          </li>
        ))}
        {roster.length === 0 && (
          <li className="texto-tenue">Sin jugadores todavía{permitirAgregar ? ' — está bien así para un juego rápido.' : '.'}</li>
        )}
      </ul>

      {permitirAgregar && (
        alcanzoTopeFiba ? (
          <div className="mensaje-error">
            Norma FIBA: 12 jugadores por partido. <button type="button" className="btn-link" onClick={() => setForzarMasDeDoce(true)}>Agregar igual</button>
          </div>
        ) : (
          <form className="fila-form" onSubmit={agregarJugador}>
            <input placeholder="Dorsal" value={dorsal} onChange={(e) => setDorsal(e.target.value)} style={{ width: 80 }} />
            <input placeholder="Nombre del jugador" value={nombreJugador} onChange={(e) => setNombreJugador(e.target.value)} required />
            <button className="btn-secundario" type="submit">+ Agregar</button>
          </form>
        )
      )}
    </div>
  );
}
