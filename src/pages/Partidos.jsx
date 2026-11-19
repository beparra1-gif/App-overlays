import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import TablaEstadisticas from '../components/TablaEstadisticas';

const ETIQUETA_ESTADO = { prepartido: 'Sin empezar', en_curso: 'En curso', finalizado: 'Finalizado' };

const formatearFecha = (iso) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function EscudoOChip({ logoUrl, color }) {
  return logoUrl
    ? <img src={logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
    : <span className="chip-color" style={{ background: color || '#8e8e93' }} />;
}

const COLUMNAS = [['dorsal', '#'], ['nombre', 'Jugador'], ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['stl', 'ROB'], ['to', 'PÉR'], ['faltas', 'FAL'], ['minutos', 'MIN']];
const filasDe = (equipo) => (equipo?.roster || []).map((j) => COLUMNAS.map(([k]) => (k === 'minutos' ? Math.round((j.segundosJugados ?? (j.minutos || 0) * 60) / 60) : j[k] ?? '')));

// Excel: CSV con ";" y BOM (Excel en español lo abre con tildes y columnas bien).
function descargarCsv(titulo, local, visita) {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [[titulo]];
  for (const eq of [local, visita]) lineas.push([], [eq.nombre], COLUMNAS.map(([, et]) => et), ...filasDe(eq));
  const csv = '﻿' + lineas.map((l) => l.map(celda).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${titulo.replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '_') || 'estadisticas'}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// PDF: una hoja simple lista para imprimir o "Guardar como PDF".
function imprimir(titulo, local, visita) {
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const tabla = (eq) => `<h2>${esc(eq.nombre)}</h2><table><tr>${COLUMNAS.map(([, et]) => `<th>${et}</th>`).join('')}</tr>${filasDe(eq).map((f) => `<tr>${f.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px}h2{font-size:16px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:center}td:nth-child(2),th:nth-child(2){text-align:left}</style><h1>${esc(titulo)}</h1>${tabla(local)}${tabla(visita)}<script>window.onload=()=>window.print()<\/script>`);
  w.document.close();
}

function ModalEstadisticas({ titulo, equipoLocal, equipoVisita, onCerrar }) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="tarjeta modal-caja" style={{ width: 'min(640px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        <TablaEstadisticas equipoLocal={equipoLocal} equipoVisita={equipoVisita} />
        <div className="fila-form" style={{ justifyContent: 'center', margin: '10px 0 0' }}>
          <button className="btn-secundario" onClick={() => descargarCsv(titulo, equipoLocal, equipoVisita)}>⬇ Excel (CSV)</button>
          <button className="btn-secundario" onClick={() => imprimir(titulo, equipoLocal, equipoVisita)}>🖨 Imprimir / PDF</button>
          <button className="btn-secundario" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function Partidos() {
  const [partidos, setPartidos] = useState(null);
  const [archivados, setArchivados] = useState(null);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalleId, setCargandoDetalleId] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const texto = busqueda.trim().toLowerCase();
  const coincide = (p) => !texto || [p.equipo_local_nombre, p.equipo_visita_nombre, p.equipo_local_categoria].some((v) => (v || '').toLowerCase().includes(texto));
  const partidosVisibles = partidos?.filter(coincide);
  const archivadosVisibles = archivados?.filter(coincide);

  useEffect(() => {
    api.listarPartidos().then((d) => setPartidos(d.partidos)).catch((err) => setError(err.message));
    api.listarPartidosArchivados().then((d) => setArchivados(d.partidos)).catch((err) => setError(err.message));
  }, []);

  const verEstadisticasPartido = async (p) => {
    setCargandoDetalleId(`p-${p.id}`);
    setError('');
    try {
      const { partido } = await api.obtenerPartido(p.id);
      setDetalle({
        titulo: `${partido.equipoLocal.nombre} ${partido.ptsLocal} — ${partido.ptsVisita} ${partido.equipoVisita.nombre}`,
        equipoLocal: partido.equipoLocal,
        equipoVisita: partido.equipoVisita,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoDetalleId(null);
    }
  };

  const verEstadisticasArchivado = async (a) => {
    setCargandoDetalleId(`a-${a.id}`);
    setError('');
    try {
      const { partido } = await api.obtenerPartidoArchivado(a.id);
      const r = partido.resumen;
      setDetalle({
        titulo: `${r.equipoLocal.nombre} ${r.ptsLocal} — ${r.ptsVisita} ${r.equipoVisita.nombre}`,
        equipoLocal: r.equipoLocal,
        equipoVisita: r.equipoVisita,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoDetalleId(null);
    }
  };

  const eliminarPartido = async (id) => {
    if (!window.confirm('¿Eliminar este partido? Se pierde el marcador, la nómina de invitados y todas las jugadas anotadas. Esta acción no se puede deshacer.')) return;
    try {
      await api.eliminarPartido(id);
      setPartidos((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminarArchivado = async (id) => {
    if (!window.confirm('¿Eliminar este partido guardado? Esta acción no se puede deshacer.')) return;
    try {
      await api.eliminarPartidoArchivado(id);
      setArchivados((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="pagina">
      <h1>Partidos</h1>
      <p className="texto-tenue">
        Estadísticas completas de cada partido, jugador por jugador. Incluye el que tengas en curso ahora y los que se guardaron solos
        al apretar "Reiniciar Partido" en la Mesa de control (arrancar el siguiente con el mismo enlace de OBS no borra las estadísticas
        del anterior — quedan acá).
      </p>
      {error && <p className="mensaje-error">{error}</p>}
      <div className="fila-form" style={{ margin: '12px 0 0' }}>
        <input type="search" placeholder="🔍 Buscar por equipo o categoría…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, maxWidth: 360 }} />
        <Link className="btn-primario" to="/en-vivo">🔴 Ir al partido en vivo</Link>
      </div>

      <h2 style={{ marginTop: 24 }}>En curso o recién jugados</h2>
      {partidos === null ? (
        <p className="texto-tenue">Cargando…</p>
      ) : partidos.length === 0 ? (
        <p className="texto-tenue">Todavía no armaste ningún partido — empezá uno desde "Diseños → Juego en vivo".</p>
      ) : partidosVisibles.length === 0 ? (
        <p className="texto-tenue">Ningún partido coincide con "{busqueda}".</p>
      ) : (
        <div className="grilla-tarjetas">
          {partidosVisibles.map((p) => (
            <div className="tarjeta" key={p.id}>
              <div className="tarjeta-header">
                <EscudoOChip logoUrl={p.equipo_local_logo_url} color={p.equipo_local_color} />
                <strong>{p.equipo_local_nombre}</strong>
                <span className="texto-tenue">vs</span>
                <strong>{p.equipo_visita_nombre}</strong>
                <EscudoOChip logoUrl={p.equipo_visita_logo_url} color={p.equipo_visita_color} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, margin: '6px 0' }}>{p.pts_local} — {p.pts_visita}</p>
              <p className="texto-tenue">{ETIQUETA_ESTADO[p.estado] || p.estado} · {formatearFecha(p.creado_en)}</p>
              <div className="tarjeta-acciones">
                <button className="btn-secundario" disabled={cargandoDetalleId === `p-${p.id}`} onClick={() => verEstadisticasPartido(p)}>
                  {cargandoDetalleId === `p-${p.id}` ? 'Cargando…' : '📊 Ver estadísticas'}
                </button>
                {p.estado !== 'finalizado' && <Link className="btn-secundario" to={`/mesa/${p.id}`}>▶ Ir a la Mesa</Link>}
                <button className="btn-link" onClick={() => eliminarPartido(p.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Guardados (reiniciados para jugar el siguiente)</h2>
      {archivados === null ? (
        <p className="texto-tenue">Cargando…</p>
      ) : archivados.length === 0 ? (
        <p className="texto-tenue">Todavía no hay ninguno — aparecen acá solos cuando reiniciás un partido que ya tenía jugadas anotadas.</p>
      ) : archivadosVisibles.length === 0 ? (
        <p className="texto-tenue">Ningún partido guardado coincide con "{busqueda}".</p>
      ) : (
        <div className="grilla-tarjetas">
          {archivadosVisibles.map((a) => (
            <div className="tarjeta" key={a.id}>
              <div className="tarjeta-header">
                <EscudoOChip logoUrl={a.equipo_local_logo_url} color={a.equipo_local_color} />
                <strong>{a.equipo_local_nombre}</strong>
                <span className="texto-tenue">vs</span>
                <strong>{a.equipo_visita_nombre}</strong>
                <EscudoOChip logoUrl={a.equipo_visita_logo_url} color={a.equipo_visita_color} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, margin: '6px 0' }}>{a.pts_local} — {a.pts_visita}</p>
              <p className="texto-tenue">
                Guardado el {formatearFecha(a.jugado_en)}
                {(a.equipo_local_categoria || a.equipo_local_rama) && ` · ${[a.equipo_local_categoria, a.equipo_local_rama === 'femenino' ? 'Femenino' : a.equipo_local_rama === 'masculino' ? 'Masculino' : null].filter(Boolean).join(' ')}`}
              </p>
              <div className="tarjeta-acciones">
                <button className="btn-secundario" disabled={cargandoDetalleId === `a-${a.id}`} onClick={() => verEstadisticasArchivado(a)}>
                  {cargandoDetalleId === `a-${a.id}` ? 'Cargando…' : '📊 Ver estadísticas'}
                </button>
                <button className="btn-link" onClick={() => eliminarArchivado(a.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detalle && (
        <ModalEstadisticas
          titulo={detalle.titulo}
          equipoLocal={detalle.equipoLocal}
          equipoVisita={detalle.equipoVisita}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
