import { urlFotoJugador } from '../../api/client';
import LogoEquipo from '../LogoEquipo';
import '../presentacion.css';

// Formatos de "Presentación del quinteto" además de la tarjeta clásica
// (ver VistaNomina). Todos reciben la lista acumulada de presentados: el
// ÚLTIMO es quien se presenta ahora; el resto ya pasó y queda a la vista.
const POSICIONES = [
  { id: 'base', etiqueta: 'Base', x: 50, y: 78 },
  { id: 'escolta', etiqueta: 'Escolta', x: 79, y: 60 },
  { id: 'alero', etiqueta: 'Alero', x: 21, y: 60 },
  { id: 'ala-pivot', etiqueta: 'Ala-pívot', x: 68, y: 30 },
  { id: 'pivot', etiqueta: 'Pívot', x: 33, y: 28 },
];

function Foto({ jugador, mostrarFoto, className }) {
  if (mostrarFoto && jugador.fotoUrl) return <img className={className} src={urlFotoJugador(jugador.fotoUrl)} alt="" />;
  return <span className={`${className} pq-foto-vacia`}>{jugador.dorsal ?? '–'}</span>;
}

const apellido = (nombre = '') => {
  const partes = nombre.trim().split(/\s+/);
  return (partes.length > 1 ? partes.slice(1).join(' ') : partes[0] || '').toUpperCase();
};

export default function PresentacionQuinteto({ formato, equipo, presentados, config, mostrarFoto, claseRaiz, estilo }) {
  const actual = presentados[presentados.length - 1];
  const anteriores = presentados.slice(0, -1);
  const color = equipo.color || '#ffd60a';
  const logo = <LogoEquipo equipo={equipo} config={config} className="pq-logo" contexto="nomina" />;
  const raiz = (contenido, extra = '') => (
    <div className={`${claseRaiz} pq-raiz pq-formato-${formato} ${extra}`} style={{ ...estilo, '--color-equipo': color }}>{contenido}</div>
  );

  if (formato === 'retratos') {
    const lugares = Array.from({ length: Math.max(5, presentados.length) });
    return raiz(
      <>
        <div className="pq-encabezado">{logo}<span>{equipo.nombre}</span><small>Quinteto inicial</small></div>
        <div className="pq-retratos">
          {lugares.map((_, i) => {
            const j = presentados[i];
            if (!j) return <div key={`v${i}`} className="pq-retrato pq-retrato-vacio"><span>?</span></div>;
            const esActual = j.id === actual.id;
            return (
              <div key={j.id} className={`pq-retrato ${esActual ? 'pq-retrato-actual' : ''}`}>
                <Foto jugador={j} mostrarFoto={mostrarFoto} className="pq-retrato-foto" />
                <span className="pq-retrato-dorsal">{j.dorsal ?? '–'}</span>
                <span className="pq-retrato-nombre">{j.nombre}</span>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (formato === 'titular') {
    return raiz(
      <div className="pq-titular-caja">
        <span className="pq-titular-palabra">QUINTETO</span>
        <div className="pq-titular-lista">
          <div className="pq-titular-equipo">{logo}{equipo.nombre}</div>
          {presentados.map((j) => (
            <div key={j.id} className={`pq-franja ${j.id === actual.id ? 'pq-franja-actual' : ''}`}>
              <span className="pq-franja-dorsal">{j.dorsal ?? '–'}</span>
              <span className="pq-franja-nombre">{j.nombre}</span>
              {j.id === actual.id && <Foto jugador={j} mostrarFoto={mostrarFoto} className="pq-franja-foto" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (formato === 'camiseta') {
    return raiz(
      <>
        <div className="pq-camiseta" key={actual.id}>
          <svg viewBox="0 0 200 230" className="pq-camiseta-forma" aria-hidden="true">
            <path d="M58 8 Q100 34 142 8 L168 18 Q176 60 196 66 L184 112 L160 104 L160 226 L40 226 L40 104 L16 112 L4 66 Q24 60 32 18 Z" />
          </svg>
          <span className="pq-camiseta-apellido">{apellido(actual.nombre)}</span>
          <span className="pq-camiseta-numero">{actual.dorsal ?? '–'}</span>
          <span className="pq-camiseta-equipo">{logo}{equipo.nombre}</span>
        </div>
        {anteriores.length > 0 && (
          <div className="pq-camisetas-chicas">
            {anteriores.map((j) => (
              <div key={j.id} className="pq-camiseta-chica"><b>{j.dorsal ?? '–'}</b><span>{apellido(j.nombre)}</span></div>
            ))}
          </div>
        )}
      </>
    );
  }

  if (formato === 'cancha') {
    return raiz(
      <div className="pq-cancha-caja">
        <div className="pq-cancha-titulo">{logo}<span>{equipo.nombre}</span><small>Quinteto inicial</small></div>
        <div className="pq-cancha">
          <span className="pq-cancha-llave" aria-hidden="true" />
          <span className="pq-cancha-arco" aria-hidden="true" />
          <span className="pq-cancha-circulo" aria-hidden="true" />
          {POSICIONES.map((pos, i) => {
            const j = presentados[i];
            return (
              <div key={pos.id} className={`pq-spot ${j ? 'pq-spot-lleno' : ''} ${j && j.id === actual.id ? 'pq-spot-actual' : ''}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                {j ? <Foto jugador={j} mostrarFoto={mostrarFoto} className="pq-spot-foto" /> : <span className="pq-spot-foto pq-foto-vacia">·</span>}
                <span className="pq-spot-etiqueta">{j ? `#${j.dorsal ?? '–'} ${j.nombre}` : pos.etiqueta}</span>
              </div>
            );
          })}
        </div>
        {presentados.length > 5 && <div className="pq-cancha-extra">{presentados.slice(5).map((j) => `#${j.dorsal ?? '–'} ${j.nombre}`).join(' · ')}</div>}
      </div>
    );
  }

  // 'cine'
  return raiz(
    <>
      <span className="pq-cine-barra pq-cine-arriba" aria-hidden="true" />
      <div className="pq-cine-escena" key={actual.id}>
        <Foto jugador={actual} mostrarFoto={mostrarFoto} className="pq-cine-foto" />
        <div className="pq-cine-texto">
          <span className="pq-cine-equipo">{logo}{equipo.nombre} · presenta</span>
          <span className="pq-cine-nombre">{actual.nombre}</span>
          <span className="pq-cine-dorsal">Número {actual.dorsal ?? '–'}</span>
        </div>
      </div>
      <span className="pq-cine-barra pq-cine-abajo" aria-hidden="true">
        {anteriores.map((j) => <span key={j.id}>#{j.dorsal ?? '–'} {apellido(j.nombre)}</span>)}
      </span>
    </>,
    'pq-cine-raiz'
  );
}
