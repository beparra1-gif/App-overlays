import { useId } from 'react';

// Camiseta de básquetbol dibujada, vista de espalda. La silueta está medida
// punto por punto sobre la foto de referencia (maqueta fotográfica): hombros
// redondeados, costados casi rectos hasta la axila (41% del alto, lo más
// ancho), cintura, leve vuelo y ruedo curvo; proporción 1 : 1,89. Detalles
// de las camisetas reales: ribetes (cuello, sisas y ruedo), números en tela
// cosida, etiqueta tejida, malla y pliegues. `color` = equipo, `color2` = secundario.
export const ESTILOS_CAMISETA = [
  { id: 'realista', etiqueta: 'Realista' },
  { id: 'clasica', etiqueta: 'Clásica' },
  { id: 'retro', etiqueta: 'Retro' },
  { id: 'paneles', etiqueta: 'Paneles laterales' },
  { id: 'bicolor', etiqueta: 'Bicolor diagonal' },
  { id: 'rayas', etiqueta: 'Rayas finas' },
];

const ANCHO = 200;
const ALTO = 378;
const CUERPO = [
  'M52 0 C60 6 72 15 100 17 C128 15 140 6 148 0',
  'L156 0 C170 2 182 6 186 12 C183 30 180 60 181 80 C183 92 190 104 200 111',
  'C196 122 192 135 188 166 C184 200 183 240 183 256 C184 290 190 320 193 350 L195 371',
  'Q194 377 188 377 Q100 381 12 377 Q6 377 5 371',
  'L7 350 C10 320 16 290 17 256 C17 240 16 200 12 166 C8 135 4 122 0 111',
  'C10 104 17 92 19 80 C20 60 17 30 14 12 C18 6 30 2 44 0 Z',
].join(' ');
const CUELLO = 'M44 0 L52 0 C60 6 72 15 100 17 C128 15 140 6 148 0 L156 0';
const SISA_IZQ = 'M48 0 C30 2 18 6 14 12 C17 30 20 60 19 80 C17 92 10 104 0 111';
const SISA_DER = 'M152 0 C170 2 182 6 186 12 C183 30 180 60 181 80 C183 92 190 104 200 111';
const RUEDO = 'M4 371 Q6 377 12 377 Q100 381 188 377 Q194 377 196 371';

const hex = (c, def) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : def);
// Mezcla dos #rrggbb (t = cuánto del segundo).
export function mezclar(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const luminancia = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Texto de tela cosida: sombra (relieve), capa de abajo (contorno), capa de
// arriba (relleno) y puntada en el borde de la capa de arriba.
function Twill({ children, relleno, contorno, grosor, ...props }) {
  const puntada = luminancia(relleno) > 0.6 ? mezclar(relleno, '#000000', 0.42) : mezclar(relleno, '#ffffff', 0.45);
  return (
    <>
      <text {...props} fill="#000" fillOpacity=".35" stroke="#000" strokeOpacity=".35" strokeWidth={grosor} transform="translate(1.6 2.6)">{children}</text>
      <text {...props} fill={contorno} stroke={contorno} strokeWidth={grosor}>{children}</text>
      <text {...props} fill={relleno} stroke={mezclar(contorno, '#000000', 0.25)} strokeWidth=".6">{children}</text>
      <text {...props} fill="none" stroke={puntada} strokeWidth=".6" strokeDasharray="1.4 1.1" strokeOpacity=".85">{children}</text>
    </>
  );
}

export default function CamisetaSvg({ estilo = 'clasica', color, color2, apellido = '', numero = '', mini = false, className = '' }) {
  const uid = `pqc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const url = (n) => `url(#${uid}-${n})`;
  const realista = estilo === 'realista';
  const p = hex(color, '#c8102e');
  // Realista: dorado por defecto (como la referencia); el resto, blanco.
  const s = hex(color2, realista ? '#e8b64c' : '#ffffff');
  const claro = mezclar(p, '#ffffff', 0.22);
  const oscuro = mezclar(p, '#000000', 0.42);
  const s2 = mezclar(s, p, 0.12);
  const sClaro = luminancia(s) > 0.7;
  const numRelleno = realista ? s : estilo === 'retro' || estilo === 'rayas' ? (sClaro ? '#ffffff' : s) : '#ffffff';
  const numContorno = sClaro ? oscuro : s;
  const fuenteNum = {
    realista: "'Oswald', 'Bebas Neue', sans-serif",
    retro: "'Alfa Slab One', 'Rockwell', serif",
    rayas: "'Alfa Slab One', 'Rockwell', serif",
    paneles: "'Archivo Black', 'Arial Black', sans-serif",
    bicolor: "'Passion One', 'Arial Black', sans-serif",
  }[estilo] || "'Anton', 'Oswald', sans-serif";
  const pesoNum = realista ? 700 : estilo === 'bicolor' ? 900 : 400;
  const parteBaja = color2 ? mezclar(s2, '#000000', 0.18) : mezclar(p, '#000000', 0.55);
  const nombre = (apellido || '').toUpperCase();
  const largo = nombre.length;
  const num = String(numero ?? '');
  // Ribete: se dibuja al doble y recortado por el cuerpo, así queda todo hacia adentro.
  const ribete = realista ? 9 : estilo === 'retro' ? 18 : 13;
  const ribeteOscuro = mezclar(s, '#000000', 0.3);

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className={className} aria-hidden="true">
      <defs>
        <clipPath id={`${uid}-clip`}><path d={CUERPO} /></clipPath>
        <linearGradient id={`${uid}-tela`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={claro} />
          <stop offset=".55" stopColor={p} />
          <stop offset="1" stopColor={oscuro} />
        </linearGradient>
        <linearGradient id={`${uid}-costados`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".42" />
          <stop offset=".17" stopColor="#000" stopOpacity="0" />
          <stop offset=".47" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".62" stopColor="#fff" stopOpacity="0" />
          <stop offset=".85" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id={`${uid}-vertical`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".8" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </linearGradient>
        <radialGradient id={`${uid}-luz`} cx=".35" cy=".18" r=".85">
          <stop offset="0" stopColor="#fff" stopOpacity=".26" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${uid}-malla`} width="4" height="3.4" patternUnits="userSpaceOnUse">
          <ellipse cx="1" cy=".9" rx=".55" ry=".42" fill="#000" fillOpacity=".2" />
          <ellipse cx="3" cy="2.6" rx=".55" ry=".42" fill="#000" fillOpacity=".2" />
        </pattern>
        <pattern id={`${uid}-rayas`} width="9" height="10" patternUnits="userSpaceOnUse">
          <rect x="0" width="1.5" height="10" fill={s} fillOpacity=".6" />
        </pattern>
        <filter id={`${uid}-suave`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
        <filter id={`${uid}-fino`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.8" /></filter>
      </defs>

      {/* Tela base y diseño */}
      <path d={CUERPO} fill={url('tela')} />
      <g clipPath={url('clip')}>
        {estilo === 'bicolor' && (
          <>
            <path d="M200 70 L200 378 L0 378 L0 330 Z" fill={parteBaja} />
            <path d="M200 70 L0 330" stroke={sClaro ? '#ffffff' : s} strokeWidth="4" />
            <path d="M200 76 L0 336" stroke={mezclar(p, '#000000', 0.3)} strokeWidth="1.1" strokeOpacity=".6" />
          </>
        )}
        {estilo === 'paneles' && (
          <>
            <path d="M0 111 C20 118 34 140 38 172 L44 378 L0 378 Z" fill={s2} />
            <path d="M200 111 C180 118 166 140 162 172 L156 378 L200 378 Z" fill={s2} />
            <path d="M38 172 L44 378 M162 172 L156 378" stroke={sClaro ? oscuro : '#ffffff'} strokeWidth="3" />
            <path d="M42 172 L48 378 M158 172 L152 378" stroke="#000" strokeOpacity=".25" strokeWidth=".7" strokeDasharray="1.5 1.3" />
          </>
        )}
        {estilo === 'rayas' && <rect x="0" y="0" width={ANCHO} height={ALTO} fill={url('rayas')} />}
        {estilo === 'clasica' && (
          <>
            <path d="M22 126 C27 200 27 290 19 368 M178 126 C173 200 173 290 181 368" stroke={s} strokeWidth="6" fill="none" />
            <path d="M22 126 C27 200 27 290 19 368 M178 126 C173 200 173 290 181 368" stroke={oscuro} strokeWidth="1.5" fill="none" />
          </>
        )}
        {estilo === 'retro' && (
          <>
            <path d="M0 332 Q100 344 200 332" stroke={s} strokeWidth="8" fill="none" />
            <path d="M0 346 Q100 358 200 346" stroke={s} strokeWidth="4" fill="none" />
          </>
        )}

        {!mini && <rect x="0" y="0" width={ANCHO} height={ALTO} fill={url('malla')} />}

        {/* Pliegues: luz al centro, vetas verticales, tirones bajo las axilas y cintura */}
        <g fill="none" filter={url('suave')}>
          <path d="M100 30 C95 130 105 250 99 376" stroke="#fff" strokeOpacity={realista ? '.17' : '.1'} strokeWidth="26" />
          <path d="M70 40 C66 140 74 250 68 376" stroke="#fff" strokeOpacity=".12" strokeWidth="9" />
          <path d="M130 40 C136 140 126 250 133 376" stroke="#fff" strokeOpacity=".1" strokeWidth="8" />
          <path d="M86 90 C82 190 90 280 84 376" stroke="#000" strokeOpacity=".14" strokeWidth="6" />
          <path d="M114 90 C118 190 110 280 116 376" stroke="#000" strokeOpacity=".12" strokeWidth="6" />
          <path d="M8 118 C34 140 56 180 72 240" stroke="#000" strokeOpacity=".2" strokeWidth="10" />
          <path d="M192 118 C166 140 144 180 128 240" stroke="#000" strokeOpacity=".2" strokeWidth="10" />
          <path d="M14 300 Q100 312 186 298" stroke="#000" strokeOpacity=".12" strokeWidth="9" />
        </g>
        {/* Sombra junto al cuello y a las sisas */}
        <g fill="none" filter={url('fino')} stroke="#000" strokeOpacity=".3" strokeWidth="7">
          <path d="M48 6 C60 13 72 22 100 24 C128 22 140 13 152 6" />
          <path d="M50 6 C34 8 24 12 21 18 C24 36 26 64 25 84 C23 97 14 110 4 118" />
          <path d="M150 6 C166 8 176 12 179 18 C176 36 174 64 175 84 C177 97 186 110 196 118" />
        </g>
        <rect x="0" y="0" width={ANCHO} height={ALTO} fill={url('costados')} />
        <rect x="0" y="0" width={ANCHO} height={ALTO} fill={url('vertical')} />
        <rect x="0" y="0" width={ANCHO} height={ALTO} fill={url('luz')} />

        {/* Ribetes del cuello, las sisas y el ruedo (acanalados), con costura */}
        <g fill="none">
          {[CUELLO, SISA_IZQ, SISA_DER, RUEDO].map((d) => (
            <g key={d}>
              <path d={d} stroke={s} strokeWidth={d === RUEDO ? ribete * 0.8 : ribete} />
              {!mini && <path d={d} stroke={ribeteOscuro} strokeWidth={d === RUEDO ? ribete * 0.8 : ribete} strokeDasharray=".6 1.5" strokeOpacity=".4" />}
              {estilo === 'retro' && <path d={d} stroke={oscuro} strokeWidth="5" />}
            </g>
          ))}
          {!mini && (
            <g stroke="#000" strokeOpacity=".38" strokeWidth=".8" strokeDasharray="1.8 1.6">
              <path d="M48 9 C60 16 72 24 100 26 C128 24 140 16 152 9" />
              <path d="M8 364 Q100 372 192 364" />
            </g>
          )}
        </g>
      </g>

      {/* Etiqueta tejida cosida en el ruedo (estilos de tela cosida) */}
      {!mini && !realista && (
        <g>
          <rect x="24" y="336" width="30" height="16" rx="1.2" fill="#f2f2f2" />
          <rect x="24" y="336" width="30" height="5" rx="1" fill={mezclar(p, '#000000', 0.15)} />
          <rect x="25.3" y="337.3" width="27.4" height="13.4" rx=".8" fill="none" stroke="#888" strokeWidth=".45" strokeDasharray="1 .8" />
          <text x="39" y="348.5" textAnchor="middle" fontSize="5.8" fontWeight="900" fill="#222" fontFamily="Arial, sans-serif" letterSpacing=".3">PRO · L</text>
        </g>
      )}

      {/* Realista: número y texto impresos planos (como la referencia) */}
      {realista && num && (
        <g textAnchor="middle" fontFamily={fuenteNum} fontWeight={pesoNum}>
          <text x="101" y={mini ? 214 : 171} fontSize={mini ? 150 : 128} fill="#000" fillOpacity=".18" letterSpacing="3">{num}</text>
          <text x="100" y={mini ? 213 : 170} fontSize={mini ? 150 : 128} fill={numRelleno} letterSpacing="3">{num}</text>
        </g>
      )}
      {realista && !mini && nombre && (
        <text x="100" y="241" textAnchor="middle" fontFamily={fuenteNum} fontWeight="700" fontSize={largo > 10 ? 20 : 26} letterSpacing={largo > 10 ? 3 : 6} fill={numRelleno}>{nombre}</text>
      )}

      {/* Resto: apellido en arco y número en tela cosida */}
      {!realista && !mini && nombre && (
        <>
          <path id={`${uid}-arco`} d="M38 104 Q100 82 162 104" fill="none" />
          <Twill relleno={numRelleno} contorno={numContorno} grosor={3.6} fontFamily={fuenteNum} fontWeight={pesoNum} fontSize={largo > 12 ? 15 : largo > 9 ? 17 : 20} letterSpacing="1.6" strokeLinejoin="round">
            <textPath href={`#${uid}-arco`} startOffset="50%" textAnchor="middle">{nombre}</textPath>
          </Twill>
        </>
      )}
      {!realista && num && (
        mini ? (
          <text x="100" y="230" textAnchor="middle" fontFamily={fuenteNum} fontWeight={pesoNum} fontSize="140" fill={numRelleno} stroke={numContorno} strokeWidth="9" paintOrder="stroke" strokeLinejoin="round">{num}</text>
        ) : (
          <Twill relleno={numRelleno} contorno={numContorno} grosor={estilo === 'retro' ? 9 : 7.5} x="100" y="214" textAnchor="middle" fontFamily={fuenteNum} fontWeight={pesoNum} fontSize={num.length > 1 ? 104 : 116} strokeLinejoin="round">{num}</Twill>
        )
      )}
    </svg>
  );
}
