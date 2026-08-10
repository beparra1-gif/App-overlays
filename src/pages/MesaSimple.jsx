import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getToken } from '../api/client';
import { crearSocket } from '../socket';
import { formatearReloj, etiquetaPeriodo } from '../marcadores/utils';
import './mesaSimple.css';

const PERIODOS_DISPONIBLES = [1, 2, 3, 4, 5, 6, 7];

// Versión mínima de la Mesa: solo puntaje, reloj, período, posesión, faltas
// por equipo y tiempos fuera — sin plantel, sin selección de jugador, sin
// disparos de nómina/estadísticas/anuncios. Pensada para quien solo
// necesita anotar el partido (un padre, un voluntario) sin capacitación
// previa, como alternativa a la Mesa amplia (ver el selector en "Juego en
// vivo" → Disenos.jsx). Usa el mismo backend/acciones que la Mesa amplia
// tal cual — es una interfaz distinta sobre las mismas reglas de juego,
// no un sistema aparte.
export default function MesaSimple({ partidoId: partidoIdProp, embebido = false, onPartidoCambio }) {
  const params = useParams();
  const id = partidoIdProp || params.id;
  const [partido, setPartido] = useState(null);
  const [error, setError] = useState('');
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);
  // Edición manual del reloj (minutos:segundos) — mismo mecanismo que Mesa
  // amplia (RELOJ_FIJAR), solo cambia la presentación acá.
  const [editandoReloj, setEditandoReloj] = useState(false);
  const [minutosRelojEdit, setMinutosRelojEdit] = useState('');
  const [segundosRelojEdit, setSegundosRelojEdit] = useState('');
  const socketRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    let activo = true;
    api.obtenerPartido(id).then((d) => {
      if (!activo) return;
      setPartido(d.partido);
      const socket = crearSocket();
      socketRef.current = socket;
      socket.on('connect', () => socket.emit('unirse_mesa', { publicToken: d.partido.publicToken }));
      socket.on('estado', (estado) => setPartido(estado));
      socket.on('error_marcador', (payload) => setError(payload.error));
    });
    return () => {
      activo = false;
      socketRef.current?.disconnect();
    };
  }, [id]);

  useEffect(() => {
    if (partido) onPartidoCambio?.(partido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partido]);

  useEffect(() => {
    const alCambiar = () => { if (!document.fullscreenElement) setEnPantallaCompleta(false); };
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const alternarPantallaCompleta = () => {
    const activar = !enPantallaCompleta;
    setEnPantallaCompleta(activar);
    try {
      if (activar) wrapRef.current?.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch { /* la clase CSS ya activada arriba alcanza igual */ }
  };

  const emitirAccion = (tipo, payload = {}) => {
    if (!socketRef.current || !partido) return;
    socketRef.current.emit('accion', { publicToken: partido.publicToken, tipo, token: getToken(), payload });
  };

  const empezarEdicionReloj = () => {
    const totalActual = partido.relojSegundos;
    setMinutosRelojEdit(String(Math.floor(totalActual / 60)));
    setSegundosRelojEdit(String(totalActual % 60).padStart(2, '0'));
    setEditandoReloj(true);
  };
  const confirmarEdicionReloj = () => {
    const minutos = Math.max(0, Number(minutosRelojEdit) || 0);
    const segundos = Math.max(0, Math.min(59, Number(segundosRelojEdit) || 0));
    emitirAccion('RELOJ_FIJAR', { segundos: minutos * 60 + segundos });
    setEditandoReloj(false);
  };
  const cancelarEdicionReloj = () => setEditandoReloj(false);

  const reiniciarPartido = () => {
    if (!window.confirm('¿Reiniciar el partido? Vuelve el marcador, faltas, reloj y estadísticas a cero. El enlace de transmisión no cambia.')) return;
    emitirAccion('PARTIDO_REINICIAR');
  };
  const finalizarPartido = () => {
    if (!window.confirm('¿Finalizar el partido? Podés reiniciarlo después si hace falta jugar otro con el mismo enlace.')) return;
    emitirAccion('ESTADO_PARTIDO', { estado: 'finalizado' });
  };

  if (error) return <p className="mensaje-error">{error}</p>;
  if (!partido) return <p className="texto-tenue">Cargando…</p>;

  if (partido.estado === 'finalizado') {
    return (
      <div className="pagina-centrada">
        <p>Este partido ya finalizó. Marcador final: {partido.ptsLocal} - {partido.ptsVisita}</p>
        <button className="btn-secundario" onClick={reiniciarPartido}>🔄 Reiniciar partido (mismo enlace)</button>
      </div>
    );
  }

  return (
    <div className={`ms-wrap ${enPantallaCompleta ? 'ms-pantalla-completa' : ''}`} ref={wrapRef}>
      <div className="ms-topbar">
        {!embebido && <Link className="ms-pill" to={`/mesa/${id}`}>📋 Mesa amplia</Link>}
        <button className="ms-pill" onClick={alternarPantallaCompleta}>
          {enPantallaCompleta ? '✕ Salir de Pantalla Completa' : '⛶ Pantalla Completa'}
        </button>
        <span className="ms-topbar-separador" />
        <button className="ms-pill" onClick={reiniciarPartido}>↺ Reiniciar</button>
        <button className="ms-pill ms-peligro" onClick={finalizarPartido}>⏹ Finalizar</button>
      </div>

      <div className="ms-scorebar">
        <div className="ms-equipo">
          <span className="ms-equipo-nombre" style={{ color: partido.equipoLocal.color }}>
            {partido.equipoLocal.nombre} {partido.posesion === 'local' && '◀'}
          </span>
          <span className="ms-puntaje">{partido.ptsLocal}</span>
          <div className="ms-puntos-botones">
            <button className="ms-btn-punto" onClick={() => emitirAccion('PUNTO', { equipo: 'local', puntos: 1 })}>+1</button>
            <button className="ms-btn-punto" onClick={() => emitirAccion('PUNTO', { equipo: 'local', puntos: 2 })}>+2</button>
            <button className="ms-btn-punto" onClick={() => emitirAccion('PUNTO', { equipo: 'local', puntos: 3 })}>+3</button>
          </div>
        </div>

        <div className="ms-centro">
          <div className="ms-reloj-control">
            <div className="ms-reloj-flechas">
              <button type="button" className="ms-reloj-flecha" title="Sumar 10 segundos" onClick={() => emitirAccion('RELOJ_AJUSTAR', { segundos: 10 })}>▲</button>
              <button type="button" className="ms-reloj-flecha" title="Restar 10 segundos" onClick={() => emitirAccion('RELOJ_AJUSTAR', { segundos: -10 })}>▼</button>
            </div>
            {editandoReloj ? (
              <span className="ms-reloj-edit">
                <input
                  type="number" inputMode="numeric" min="0" max="99" autoFocus
                  value={minutosRelojEdit}
                  onChange={(e) => setMinutosRelojEdit(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarEdicionReloj(); if (e.key === 'Escape') cancelarEdicionReloj(); }}
                  title="Minutos"
                />
                :
                <input
                  type="number" inputMode="numeric" min="0" max="59"
                  value={segundosRelojEdit}
                  onChange={(e) => setSegundosRelojEdit(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarEdicionReloj(); if (e.key === 'Escape') cancelarEdicionReloj(); }}
                  title="Segundos"
                />
                <button type="button" className="ms-reloj-edit-btn ok" title="Guardar" onClick={confirmarEdicionReloj}>✓</button>
                <button type="button" className="ms-reloj-edit-btn cancelar" title="Cancelar" onClick={cancelarEdicionReloj}>✕</button>
              </span>
            ) : (
              <button type="button" className="ms-reloj" onClick={empezarEdicionReloj} title="Tocar para editar el reloj a mano">
                {formatearReloj(partido.relojSegundos)}
              </button>
            )}
          </div>
          <span className="ms-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          <button className="ms-pill" onClick={() => emitirAccion('POSESION_TOGGLE')} title="Cambiar posesión">⇄ Posesión</button>
        </div>

        <div className="ms-equipo">
          <span className="ms-equipo-nombre" style={{ color: partido.equipoVisita.color }}>
            {partido.posesion === 'visita' && '▶'} {partido.equipoVisita.nombre}
          </span>
          <span className="ms-puntaje">{partido.ptsVisita}</span>
          <div className="ms-puntos-botones">
            <button className="ms-btn-punto" onClick={() => emitirAccion('PUNTO', { equipo: 'visita', puntos: 1 })}>+1</button>
            <button className="ms-btn-punto" onClick={() => emitirAccion('PUNTO', { equipo: 'visita', puntos: 2 })}>+2</button>
            <button className="ms-btn-punto" onClick={() => emitirAccion('PUNTO', { equipo: 'visita', puntos: 3 })}>+3</button>
          </div>
        </div>
      </div>

      <div className="ms-seccion">
        <h6>Reloj y período</h6>
        <div className="ms-fila">
          {partido.relojCorriendo ? (
            <button className="ms-pill ms-primario" onClick={() => emitirAccion('RELOJ_PAUSAR')}>⏸ Pausar</button>
          ) : (
            <button className="ms-pill ms-primario" onClick={() => emitirAccion('RELOJ_INICIAR')}>▶ Iniciar</button>
          )}
          <button className="ms-pill" onClick={() => emitirAccion('RELOJ_AJUSTAR', { segundos: 60 })}>+1:00</button>
          <button className="ms-pill" onClick={() => emitirAccion('RELOJ_AJUSTAR', { segundos: -60 })}>-1:00</button>
          <button className="ms-pill" onClick={() => emitirAccion('RELOJ_REINICIAR')}>↺ Reiniciar reloj</button>
          <select
            className="ms-pill ms-select-periodo"
            value={partido.periodo}
            onChange={(e) => emitirAccion('PERIODO_FIJAR', { periodo: Number(e.target.value) })}
            style={{ cursor: 'pointer' }}
          >
            {PERIODOS_DISPONIBLES.map((p) => <option key={p} value={p}>{etiquetaPeriodo(p)}</option>)}
          </select>
        </div>
      </div>

      <div className="ms-seccion ms-faltas-timeouts">
        <div>
          <h6>Faltas</h6>
          <div className="ms-fila">
            <div className="ms-contador" style={{ flex: 1 }}>
              <span>{partido.equipoLocal.nombre}</span>
              <span className="ms-contador-valor">{partido.faltasPeriodoLocal}</span>
              <button className="ms-pill" onClick={() => emitirAccion('FALTA', { equipo: 'local' })}>+ Falta</button>
            </div>
          </div>
          <div className="ms-fila" style={{ marginTop: 6 }}>
            <div className="ms-contador" style={{ flex: 1 }}>
              <span>{partido.equipoVisita.nombre}</span>
              <span className="ms-contador-valor">{partido.faltasPeriodoVisita}</span>
              <button className="ms-pill" onClick={() => emitirAccion('FALTA', { equipo: 'visita' })}>+ Falta</button>
            </div>
          </div>
        </div>
        <div>
          <h6>Tiempos fuera</h6>
          <div className="ms-fila">
            <div className="ms-contador" style={{ flex: 1 }}>
              <span>{partido.equipoLocal.nombre}</span>
              <span className="ms-contador-valor">{partido.timeoutsLocal}</span>
              <button className="ms-pill" disabled={partido.timeoutsLocal <= 0} onClick={() => emitirAccion('TIMEOUT', { equipo: 'local' })}>Usar</button>
            </div>
          </div>
          <div className="ms-fila" style={{ marginTop: 6 }}>
            <div className="ms-contador" style={{ flex: 1 }}>
              <span>{partido.equipoVisita.nombre}</span>
              <span className="ms-contador-valor">{partido.timeoutsVisita}</span>
              <button className="ms-pill" disabled={partido.timeoutsVisita <= 0} onClick={() => emitirAccion('TIMEOUT', { equipo: 'visita' })}>Usar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
