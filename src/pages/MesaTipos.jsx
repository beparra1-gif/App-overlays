import { useState } from 'react';
import { formatearReloj, etiquetaPeriodo, formatearPosesion } from '../marcadores/utils';
import './mesaTipos.css';

// Tipos de mesa además de la Clásica (cada operador elige con cuál trabajar):
// - consola: anotar a la izquierda, lo que sale al aire a la derecha (H2R/vMix).
// - tablet: botones enormes para tocar sin mirar; gráficos en un cajón.
// - jugadora: se elige el número y después la acción (FIBA LiveStats).
// Todas usan las mismas acciones del socket que la Mesa clásica.
export const TIPOS_MESA = [
  { id: 'clasica', etiqueta: 'Clásica' },
  { id: 'consola', etiqueta: 'Consola' },
  { id: 'tablet', etiqueta: 'Tablet' },
  { id: 'jugadora', etiqueta: 'Por jugadora' },
];

const LADOS = ['local', 'visita'];
const equipoDe = (p, lado) => (lado === 'local' ? p.equipoLocal : p.equipoVisita);
const ptsDe = (p, lado) => (lado === 'local' ? p.ptsLocal : p.ptsVisita);
const faltasDe = (p, lado) => (lado === 'local' ? p.faltasPeriodoLocal : p.faltasPeriodoVisita) ?? 0;
const bonusDe = (p, lado) => Boolean(lado === 'local' ? p.bonusLocal : p.bonusVisita);
const tiemposDe = (p, lado) => (lado === 'local' ? p.timeoutsLocal : p.timeoutsVisita) ?? 0;

function Tiempos({ restantes }) {
  return (
    <span className="mt-tiempos" aria-label={`${restantes} tiempos muertos`}>
      {Array.from({ length: Math.max(3, restantes) }).map((_, i) => <i key={i} className={i < restantes ? 'on' : ''} />)}
    </span>
  );
}

// Lo que sale al aire: cada botón muestra si está en pantalla.
function PanelGraficos({ graficos, compacto = false }) {
  return (
    <div className={`mt-graficos ${compacto ? 'mt-graficos-compacto' : ''}`}>
      {graficos.map((g) => (g.separador
        ? <span key={g.separador} className="mt-graficos-sep">{g.separador}</span>
        : (
          <button key={g.id} type="button" className={`mt-btn ${g.activo ? 'mt-aire' : ''}`} onClick={g.onClick} title={g.ayuda}>
            {g.activo ? '● ' : ''}{g.etiqueta}
          </button>
        )))}
    </div>
  );
}

function Equipo({ partido, lado, grande = false }) {
  const equipo = equipoDe(partido, lado);
  return (
    <div className={`mt-equipo mt-${lado} ${grande ? 'mt-equipo-grande' : ''}`} style={{ '--mt-color': equipo.color || (lado === 'local' ? '#ff3b30' : '#0a84ff') }}>
      <span className="mt-equipo-nombre">
        {lado === 'visita' && partido.posesion === 'visita' && '▶ '}{equipo.nombre}{lado === 'local' && partido.posesion === 'local' && ' ◀'}
      </span>
      <span className="mt-pts">{ptsDe(partido, lado)}</span>
      <span className="mt-equipo-pie">
        {bonusDe(partido, lado) ? <b className="mt-bonus">BONUS</b> : `Faltas ${faltasDe(partido, lado)}`} · TM <Tiempos restantes={tiemposDe(partido, lado)} />
      </span>
    </div>
  );
}

function Reloj({ partido, reloj, posesion, emitir, grande = false }) {
  const alternar = () => emitir(partido.relojCorriendo ? 'RELOJ_PAUSAR' : 'RELOJ_INICIAR');
  return (
    <button type="button" className={`mt-reloj ${grande ? 'mt-reloj-grande' : ''} ${partido.relojCorriendo ? 'corriendo' : ''}`} onClick={alternar} title="Tocar para iniciar o pausar (Espacio)">
      <span className="mt-reloj-valor">{formatearReloj(reloj)}</span>
      <span className="mt-reloj-pie">
        {etiquetaPeriodo(partido.periodo)} · 24" <b className={posesion < 5 ? 'mt-alerta' : ''}>{formatearPosesion(posesion)}</b>
        {grande && <em>{partido.relojCorriendo ? ' · tocar para pausar' : ' · tocar para iniciar'}</em>}
      </span>
    </button>
  );
}

function ControlesReloj({ partido, emitir }) {
  return (
    <div className="mt-fila mt-controles">
      <button type="button" className="mt-btn mt-principal" onClick={() => emitir(partido.relojCorriendo ? 'RELOJ_PAUSAR' : 'RELOJ_INICIAR')}>
        {partido.relojCorriendo ? '⏸ Pausar' : '▶ Iniciar'}
      </button>
      <button type="button" className="mt-btn" onClick={() => emitir('POSESION_FIJAR', { segundos: 24 })}>24"</button>
      <button type="button" className="mt-btn" onClick={() => emitir('POSESION_FIJAR', { segundos: 14 })}>14"</button>
      <button type="button" className="mt-btn" title="Restar un segundo al reloj" onClick={() => emitir('RELOJ_AJUSTAR', { segundos: -1 })}>−1 s</button>
      <button type="button" className="mt-btn" title="Sumar un segundo al reloj" onClick={() => emitir('RELOJ_AJUSTAR', { segundos: 1 })}>+1 s</button>
      <button type="button" className="mt-btn" title="Pasar al cuarto siguiente" onClick={() => emitir('PERIODO_FIJAR', { periodo: partido.periodo + 1 })}>{etiquetaPeriodo(partido.periodo + 1)} ▸</button>
      <button type="button" className="mt-btn" title="Cambiar la posesión" onClick={() => emitir('POSESION_TOGGLE')}>⇄ Posesión</button>
    </div>
  );
}

function BotonesEquipo({ lado, emitir, pedirTiempo, grande = false }) {
  return (
    <>
      <div className={`mt-fila mt-puntos ${grande ? 'mt-puntos-grandes' : ''}`}>
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" className={`mt-btn mt-btn-${lado}`} onClick={() => emitir('PUNTO', { equipo: lado, jugadorId: null, puntos: n })}>+{n}</button>
        ))}
      </div>
      <div className="mt-fila">
        <button type="button" className="mt-btn" onClick={() => emitir('FALTA', { equipo: lado, jugadorId: null, tipoFalta: 'personal' })}>Falta</button>
        <button type="button" className="mt-btn" onClick={() => pedirTiempo(lado)}>Tiempo muerto</button>
      </div>
    </>
  );
}

function Consola({ partido, reloj, posesion, emitir, pedirTiempo, graficos }) {
  return (
    <div className="mt-consola">
      <section className="mt-tarjeta">
        <div className="mt-cabecera">
          <Equipo partido={partido} lado="local" />
          <Reloj partido={partido} reloj={reloj} posesion={posesion} emitir={emitir} />
          <Equipo partido={partido} lado="visita" />
        </div>
        <div className="mt-dos">
          {LADOS.map((lado) => <div key={lado}><BotonesEquipo lado={lado} emitir={emitir} pedirTiempo={pedirTiempo} /></div>)}
        </div>
        <ControlesReloj partido={partido} emitir={emitir} />
      </section>
      <section className="mt-tarjeta">
        <p className="mt-titulo">En pantalla</p>
        <PanelGraficos graficos={graficos} />
      </section>
    </div>
  );
}

function Tablet({ partido, reloj, posesion, emitir, pedirTiempo, graficos }) {
  const [cajon, setCajon] = useState(false);
  return (
    <div className="mt-tablet">
      <div className="mt-tres">
        <div><Equipo partido={partido} lado="local" grande /><BotonesEquipo lado="local" emitir={emitir} pedirTiempo={pedirTiempo} grande /></div>
        <div className="mt-centro">
          <Reloj partido={partido} reloj={reloj} posesion={posesion} emitir={emitir} grande />
          <div className="mt-fila">
            <button type="button" className="mt-btn mt-btn-grande" onClick={() => emitir('POSESION_FIJAR', { segundos: 24 })}>24"</button>
            <button type="button" className="mt-btn mt-btn-grande" onClick={() => emitir('POSESION_FIJAR', { segundos: 14 })}>14"</button>
          </div>
          <div className="mt-fila">
            <button type="button" className="mt-btn" onClick={() => emitir('POSESION_TOGGLE')}>⇄ Posesión</button>
            <button type="button" className="mt-btn" onClick={() => emitir('PERIODO_FIJAR', { periodo: partido.periodo + 1 })}>{etiquetaPeriodo(partido.periodo + 1)} ▸</button>
          </div>
        </div>
        <div><Equipo partido={partido} lado="visita" grande /><BotonesEquipo lado="visita" emitir={emitir} pedirTiempo={pedirTiempo} grande /></div>
      </div>
      <button type="button" className="mt-btn mt-cajon-boton" onClick={() => setCajon((v) => !v)} aria-expanded={cajon}>
        {cajon ? '▾' : '▴'} Gráficos en pantalla{graficos.some((g) => g.activo && g.id !== 'marcador') ? ' · hay uno al aire' : ''}
      </button>
      {cajon && <PanelGraficos graficos={graficos} compacto />}
    </div>
  );
}

function Jugadora({ partido, reloj, posesion, emitir, pedirTiempo, graficos, enCancha, banca, pedirCambio }) {
  const [elegida, setElegida] = useState(null); // { lado, id }  (id null = el equipo, sin nómina)
  const [verBanca, setVerBanca] = useState({ local: false, visita: false });
  const [verGraficos, setVerGraficos] = useState(false);
  const jugadorasDe = (lado) => (verBanca[lado] ? banca(lado) : enCancha(lado));
  const sinNomina = (lado) => enCancha(lado).length === 0 && banca(lado).length === 0;
  const jugadora = elegida?.id != null ? [...enCancha(elegida.lado), ...banca(elegida.lado)].find((j) => j.id === elegida.id) : null;
  const disparar = (tipo, extra = {}) => {
    if (!elegida) return;
    emitir(tipo, { equipo: elegida.lado, jugadorId: elegida.id, ...extra });
  };
  const columna = (lado) => (
    <div className={`mt-plantel mt-${lado}`} style={{ '--mt-color': equipoDe(partido, lado).color }}>
      {sinNomina(lado) ? (
        <button type="button" className={`mt-btn mt-dorsal mt-dorsal-equipo ${elegida?.lado === lado ? 'mt-elegida' : ''}`} onClick={() => setElegida({ lado, id: null })}>
          {equipoDe(partido, lado).nombre}<small>sin nómina</small>
        </button>
      ) : jugadorasDe(lado).map((j) => (
        <button key={j.id} type="button" className={`mt-btn mt-dorsal ${elegida?.id === j.id ? 'mt-elegida' : ''} ${j.faltas >= 4 ? 'mt-cargada' : ''}`} onClick={() => setElegida({ lado, id: j.id })} title={`${j.nombre} · ${j.pts || 0} pts · ${j.faltas || 0} faltas`}>
          {j.dorsal ?? '–'}
        </button>
      ))}
      {!sinNomina(lado) && (
        <button type="button" className="mt-btn mt-dorsal mt-banca" onClick={() => setVerBanca((v) => ({ ...v, [lado]: !v[lado] }))}>
          {verBanca[lado] ? 'cancha' : 'banca'}
        </button>
      )}
    </div>
  );
  return (
    <div className="mt-jugadora">
      <div className="mt-barra">
        <span className="mt-barra-pts" style={{ color: partido.equipoLocal.color }}>{partido.equipoLocal.nombre} {partido.ptsLocal}</span>
        <Reloj partido={partido} reloj={reloj} posesion={posesion} emitir={emitir} />
        <span className="mt-barra-pts" style={{ color: partido.equipoVisita.color }}>{partido.ptsVisita} {partido.equipoVisita.nombre}</span>
        <span className="mt-espacio" />
        <button type="button" className="mt-btn" onClick={() => pedirTiempo('local')}>TM local</button>
        <button type="button" className="mt-btn" onClick={() => pedirTiempo('visita')}>TM visita</button>
        <button type="button" className="mt-btn" onClick={() => emitir('POSESION_TOGGLE')}>⇄</button>
        <button type="button" className={`mt-btn ${verGraficos ? 'mt-aire' : ''}`} onClick={() => setVerGraficos((v) => !v)}>📺 Gráficos {verGraficos ? '▴' : '▾'}</button>
      </div>
      {verGraficos && <PanelGraficos graficos={graficos} compacto />}
      <div className="mt-tres mt-tres-jugadora">
        {columna('local')}
        <div className="mt-acciones">
          <p className="mt-quien">
            {!elegida ? 'Elige una jugadora (o el equipo, si no tiene nómina)'
              : jugadora ? <><b>#{jugadora.dorsal ?? '–'} {jugadora.nombre}</b> · {jugadora.pts || 0} pts · {jugadora.faltas || 0} faltas</>
                : <b>{equipoDe(partido, elegida.lado).nombre}</b>}
          </p>
          <div className={`mt-grilla ${elegida ? '' : 'mt-apagada'}`}>
            <button type="button" className="mt-btn mt-bien" onClick={() => disparar('PUNTO', { puntos: 2 })}>2 pts</button>
            <button type="button" className="mt-btn mt-bien" onClick={() => disparar('PUNTO', { puntos: 3 })}>3 pts</button>
            <button type="button" className="mt-btn mt-bien" onClick={() => disparar('TIRO_LIBRE', { convertidos: 1, intentos: 1 })}>Libre ✓</button>
            <button type="button" className="mt-btn" onClick={() => disparar('TIRO_LIBRE', { convertidos: 0, intentos: 1 })}>Libre ✗</button>
            <button type="button" className="mt-btn mt-mal" onClick={() => disparar('FALTA', { tipoFalta: 'personal' })}>Falta</button>
            <button type="button" className="mt-btn" onClick={() => disparar('REBOTE')}>Rebote</button>
            <button type="button" className="mt-btn" onClick={() => disparar('ASISTENCIA')}>Asistencia</button>
            <button type="button" className="mt-btn" onClick={() => disparar('ROBO')}>Robo</button>
            <button type="button" className="mt-btn" onClick={() => disparar('PERDIDA')}>Pérdida</button>
            <button type="button" className="mt-btn" disabled={!jugadora} onClick={() => jugadora && pedirCambio(elegida.lado, jugadora.id)}>Cambio</button>
          </div>
        </div>
        {columna('visita')}
      </div>
      <ControlesReloj partido={partido} emitir={emitir} />
    </div>
  );
}

export default function MesaTipos({ tipo, ...props }) {
  if (tipo === 'consola') return <Consola {...props} />;
  if (tipo === 'tablet') return <Tablet {...props} />;
  if (tipo === 'jugadora') return <Jugadora {...props} />;
  return null;
}
