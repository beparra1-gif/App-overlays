// Librería de íconos deportivos para el Creador (tipo "icono" en
// ElementosLibres.jsx) — pensada para que el usuario le sume detalle
// profesional a un tablero (estrella de MVP, trofeo de campeonato, rayo de
// "en racha", silbato/medalla/escudo, la pelota misma) SIN tener que subir
// una imagen propia. Cada ícono es un `<path>`/formas simples en un
// viewBox 0 0 24 24, coloreadas con `currentColor` — así un solo campo
// `color` en el elemento pinta el ícono entero, sin depender de qué color
// tenga la imagen (que es justo la limitación de usar un logo subido para
// esto). Los detalles internos (costuras de la pelota, agujas del reloj)
// se dibujan con un trazo semitransparente para que se noten encima de
// cualquier color elegido.
export const CATALOGO_ICONOS = [
  { id: 'pelota', etiqueta: 'Pelota' },
  { id: 'trofeo', etiqueta: 'Trofeo' },
  { id: 'estrella', etiqueta: 'Estrella' },
  { id: 'corona', etiqueta: 'Corona' },
  { id: 'medalla', etiqueta: 'Medalla' },
  { id: 'escudo', etiqueta: 'Escudo' },
  { id: 'rayo', etiqueta: 'Rayo' },
  { id: 'fuego', etiqueta: 'Fuego' },
  { id: 'bandera', etiqueta: 'Bandera' },
  { id: 'reloj', etiqueta: 'Cronómetro' },
];

const TRAZO_DETALLE = 'rgba(0,0,0,.4)';

function Pelota() {
  return (
    <>
      <circle cx="12" cy="12" r="10" />
      <g fill="none" stroke={TRAZO_DETALLE} strokeWidth="1.3">
        <path d="M12 2v20" />
        <path d="M2 12h20" />
        <path d="M4.8 5.3c2.8 3 2.8 10.4 0 13.4" />
        <path d="M19.2 5.3c-2.8 3-2.8 10.4 0 13.4" />
      </g>
    </>
  );
}

function Trofeo() {
  return (
    <path d="M7 3h10v3a5 5 0 0 1-4 4.9V14h2a1 1 0 0 1 1 1v1H8v-1a1 1 0 0 1 1-1h2v-3.1A5 5 0 0 1 7 6V3zM5 4H3v2a4 4 0 0 0 4 4V8a2 2 0 0 1-2-2V4zM19 4h2v2a4 4 0 0 1-4 4V8a2 2 0 0 0 2-2V4z" />
  );
}

function Estrella() {
  return <path d="M12 1.5l2.6 6.6 7.1.3-5.6 4.4 2 6.8L12 15.8 5.9 19.6l2-6.8-5.6-4.4 7.1-.3z" />;
}

function Corona() {
  return <path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4z" />;
}

function Medalla() {
  return (
    <>
      <path d="M8 2 4 10l4 2 2-4zM16 2l4 8-4 2-2-4z" />
      <circle cx="12" cy="15" r="6" />
      <circle cx="12" cy="15" r="2.6" fill="none" stroke={TRAZO_DETALLE} strokeWidth="1.2" />
    </>
  );
}

function Escudo() {
  return <path d="M12 2 4 5v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V5z" />;
}

function Rayo() {
  return <path d="M13 1 3 14h6l-1 9 11-14h-7l1-8z" />;
}

function Fuego() {
  return <path d="M12 2c.6 3.2-2.8 4.3-2.8 7.4a2.8 2.8 0 0 0 5.6 0c0-1-.4-1.6-.9-2.1 1.4.3 3.1 2.1 3.1 5.1a5 5 0 0 1-10 0C7 7.5 10.8 6 12 2z" />;
}

function Bandera() {
  return (
    <>
      <rect x="4" y="2" width="1.6" height="20" rx="0.5" />
      <path d="M6 3h13l-3 4 3 4H6z" />
    </>
  );
}

function Reloj() {
  return (
    <>
      <circle cx="12" cy="13" r="9" />
      <rect x="10" y="1" width="4" height="3" rx="1" />
      <g stroke={TRAZO_DETALLE} strokeWidth="1.4" strokeLinecap="round">
        <path d="M12 13V7.5" />
        <path d="M12 13l3.5 1.8" />
      </g>
    </>
  );
}

const RENDER_POR_ICONO = {
  pelota: Pelota,
  trofeo: Trofeo,
  estrella: Estrella,
  corona: Corona,
  medalla: Medalla,
  escudo: Escudo,
  rayo: Rayo,
  fuego: Fuego,
  bandera: Bandera,
  reloj: Reloj,
};

export function IconoSvg({ id, color = '#ffd60a' }) {
  const Forma = RENDER_POR_ICONO[id] || Estrella;
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ display: 'block', color, fill: 'currentColor' }}>
      <Forma />
    </svg>
  );
}
