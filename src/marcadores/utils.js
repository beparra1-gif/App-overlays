import { useEffect, useRef, useState } from 'react';

// Bajo el minuto (minutos === 0) y con un valor NO entero (ver useRelojVivo,
// más abajo — el resto de la app sigue mandando enteros, que caen en la
// rama de siempre) se suma la décima de segundo: más seriedad justo en el
// momento más tenso del período, como en una transmisión real.
export const formatearReloj = (totalSegundos = 0) => {
  const segurosTotal = Math.max(0, Number(totalSegundos) || 0);
  const minutos = Math.floor(segurosTotal / 60);
  const segundos = segurosTotal % 60;
  if (minutos === 0 && !Number.isInteger(segurosTotal)) {
    const segEnteros = Math.floor(segundos);
    const decima = Math.floor((segundos - segEnteros) * 10);
    return `${String(minutos).padStart(2, '0')}:${String(segEnteros).padStart(2, '0')}.${decima}`;
  }
  return `${String(minutos).padStart(2, '0')}:${String(Math.floor(segundos)).padStart(2, '0')}`;
};

export const etiquetaPeriodo = (periodo = 1) => (periodo <= 4 ? `Q${periodo}` : `OT${periodo - 4}`);

// Las perillas de color de un diseño guardado se aplican como variables CSS
// en el contenedor raíz de la plantilla — así ninguna plantilla necesita
// lógica propia de theming, solo referenciar var(--pm-*, <default>) en su
// CSS. La tipografía NO es una de estas perillas a propósito: cada plantilla
// trae su propia fuente fija como parte de su identidad visual (ver el
// font-family de cada bloque en plantillas.css) — mezclar cualquier fuente
// con cualquier diseño los hacía verse todos iguales.

// Coordenadas rápidas para el posicionador — solo pre-cargan X/Y, el
// arrastre libre hace el resto. -1 en x/y significa "sin tocar" (no se usa).
export const PRESETS_POSICION = [
  { id: 'superior-izquierda', etiqueta: 'Arriba izq.', x: 10, y: 10 },
  { id: 'superior-centro', etiqueta: 'Arriba centro', x: 50, y: 10 },
  { id: 'superior-derecha', etiqueta: 'Arriba der.', x: 90, y: 10 },
  { id: 'centro', etiqueta: 'Centro', x: 50, y: 50 },
  { id: 'inferior-izquierda', etiqueta: 'Abajo izq.', x: 10, y: 88 },
  { id: 'inferior-centro', etiqueta: 'Abajo centro', x: 50, y: 88 },
  { id: 'inferior-derecha', etiqueta: 'Abajo der.', x: 90, y: 88 },
];

// Mitad del tamaño típico (en % del canvas) de la "caja" de una plantilla —
// como cada una mide distinto y no lo sabemos desde afuera, se usa como
// aproximación para que el punto que arrastrás quede razonablemente centrado
// en la caja real; el ajuste fino se termina a ojo con la vista previa en
// vivo. Las plantillas "barra completa" (Ticker, ESPN Ticker) no tienen caja
// que mover — position/escala no les hace nada, a propósito.
const MITAD_CAJA_X = 13;
const MITAD_CAJA_Y = 8;

// Quirk de CSS: el % de `padding-top`/`padding-bottom` SIEMPRE se calcula
// sobre el ANCHO del contenedor, nunca sobre su alto (así lo define el spec,
// incluso para top/bottom). Como posY se piensa como "% de la altura" (igual
// que lo captura el arrastre, en base al alto real del recuadro), hay que
// reescalar por la relación alto/ancho del canvas de referencia (1920×1080)
// antes de usarlo como padding-top — si no, cualquier posY quedaba
// multiplicado por ~1.78 y todo lo que no fuera la posición por defecto de
// cada plantilla salía mal ubicado verticalmente (este era el bug real
// detrás de "las acciones del jugador no aparecen arriba del marcador").
const RATIO_ALTO_SOBRE_ANCHO = 1080 / 1920;
const paddingTopDesdeY = (y) => `${Math.max(0, y) * RATIO_ALTO_SOBRE_ANCHO}%`;

// Convierte un hex (#RRGGBB) + un % de opacidad a rgba(...) — cada color
// del diseño (tablero/banner/marcador/texto) tiene su PROPIO nivel de
// transparencia, independiente de los demás.
export function hexConAlpha(hex, alphaPct) {
  const limpio = String(hex || '').replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(limpio)) return hex;
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const a = Math.max(0, Math.min(100, Number.isFinite(alphaPct) ? alphaPct : 100)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Solo colores/tipografía — lo que usan Nómina/Estadísticas/Anuncios para
// coordinar con el diseño elegido. A propósito NO toca posición/escala: esas
// pantallas ya tienen su propio layout de pantalla completa fijo, y aplicar
// el mismo padding/transform pensado para "mover la cajita del marcador" las
// descolocaría por completo.
// "Colores según equipo" (Personalizar → Marcador → Colores): toma el color
// de un equipo — local, visita o el que va GANANDO (cambia solo durante el
// partido) — y lo aplica al acento o al acento + fondo de TODAS las capas.
// Solo completa lo que el diseño no fijó a mano en cada capa.
const HEX6 = /^#[0-9a-f]{6}$/i;
export function oscurecerHex(hex, cuanto = 0.75) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - cuanto)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
export function equipoParaColores(config, partido) {
  const modo = config?.coloresEquipo;
  if (!modo || !partido) return null;
  if (modo === 'local') return partido.equipoLocal;
  if (modo === 'visita') return partido.equipoVisita;
  if (modo === 'ganador') return (partido.ptsVisita ?? 0) > (partido.ptsLocal ?? 0) ? partido.equipoVisita : partido.equipoLocal;
  return null;
}
export function aplicarColoresEquipo(config, partido) {
  const color = equipoParaColores(config, partido)?.color;
  if (!config || !HEX6.test(color || '')) return config;
  const nuevo = { ...config, colorBanner: color, colorBannerAlpha: 100 };
  if (config.coloresEquipoAlcance === 'acento-fondo') {
    const fondo = oscurecerHex(color, 0.72);
    Object.assign(nuevo, { colorTablero: fondo, colorTableroAlpha: 94, colorTexto: '#ffffff', colorTextoAlpha: 100, colorMarcador: '#ffffff', colorMarcadorAlpha: 100 });
    for (const capa of ['nomina', 'estadisticas', 'intertanto', 'anuncios']) {
      if (!config[`${capa}ColorFondo`]) { nuevo[`${capa}ColorFondo`] = oscurecerHex(color, 0.78); nuevo[`${capa}ColorFondoAlpha`] = 94; }
      if (!config[`${capa}ColorTexto`]) nuevo[`${capa}ColorTexto`] = '#ffffff';
    }
  }
  return nuevo;
}

export function estiloTema(config = {}) {
  const estilo = {};
  if (config?.colorTablero) estilo['--pm-tablero'] = hexConAlpha(config.colorTablero, config.colorTableroAlpha);
  if (config?.colorBanner) estilo['--pm-banner'] = hexConAlpha(config.colorBanner, config.colorBannerAlpha);
  if (config?.colorMarcador) estilo['--pm-marcador'] = hexConAlpha(config.colorMarcador, config.colorMarcadorAlpha);
  if (config?.colorTexto) estilo['--pm-texto'] = hexConAlpha(config.colorTexto, config.colorTextoAlpha);
  if (Number.isFinite(config?.logoOpacidad)) estilo['--pm-logo-opacidad'] = config.logoOpacidad / 100;
  if (Number.isFinite(config?.tamanoTextoMarcador)) estilo['--pm-escala-pts'] = config.tamanoTextoMarcador / 100;
  if (Number.isFinite(config?.tamanoTextoNombre)) estilo['--pm-escala-nombre'] = config.tamanoTextoNombre / 100;
  return estilo;
}

// La aproximación de "media caja" tiene que crecer/achicarse junto con todo
// lo que agranda o achica la caja real (escala general, tamaño de los
// números, tamaño del nombre) — si no, mover cualquiera de esos controles
// después de haber posicionado el marcador hace que el punto de anclaje ya
// no quede centrado en la caja (se ve como si la posición se "distorsionara"
// sola). No es exacto (no conocemos el layout real de cada plantilla desde
// acá), pero sigue el tamaño mucho mejor que una constante fija.
// Exportada porque LogoMarcaAgua también la necesita: para confinar la marca
// de agua "dentro" del marcador hace falta saber el ancho/alto aproximado
// de la caja, no solo el punto central.
export function mitadCajaProporcional(config) {
  const escala = Number(config?.escala) || 1;
  // Ensanchar/alargar (config.estiramientoAncho/Alto) son independientes de
  // la escala general: agrandan un solo eje sin tocar el otro, para poder
  // ajustar proporción sin perder el tamaño ya calibrado en el otro eje.
  const estiramientoAncho = (Number(config?.estiramientoAncho) || 100) / 100;
  const estiramientoAlto = (Number(config?.estiramientoAlto) || 100) / 100;
  const escalaTexto = Math.max(
    Number(config?.tamanoTextoMarcador) || 100,
    Number(config?.tamanoTextoNombre) || 100,
  ) / 100;
  const factorBase = 0.7 + escalaTexto * 0.3;
  return {
    x: MITAD_CAJA_X * escala * estiramientoAncho * factorBase,
    y: MITAD_CAJA_Y * escala * estiramientoAlto * factorBase,
  };
}

export function estiloPersonalizado(config = {}) {
  const estilo = estiloTema(config);
  // Sin esto, cada plantilla sigue usando su propia tipografía fija de
  // siempre (el valor por defecto de la variable CSS, ya escrito en
  // plantillas.css) — solo se pisa cuando el usuario eligió una a mano en
  // "Personalizar diseño → Marcador → Tipografía".
  if (config?.fuenteMarcador) estilo['--pm-fuente'] = config.fuenteMarcador;

  const tienePosicion = Number.isFinite(config?.posX) && Number.isFinite(config?.posY);
  const transformas = [];

  if (tienePosicion) {
    // Centrado EXACTO en cualquier plantilla: antes se adivinaba el ancho y
    // el alto de la caja (mitadCajaProporcional, una CONSTANTE fija — 13%/8%
    // del lienzo — igual para las 25 plantillas) y se restaba del
    // padding-left/padding-top para "simular" que el punto arrastrado era el
    // centro de la caja. Como cada plantilla mide distinto de verdad, esa
    // resta quedaba mal por una cantidad distinta en cada una — "Centro" (o
    // cualquier otra posición) terminaba corrido hacia un lado según cuánto
    // más ancha/angosta fuera la caja real contra el 13% supuesto. Acá en
    // cambio se deja que flexbox centre la caja DE VERDAD (align-items /
    // justify-content: center — exacto, lo calcula el navegador con el
    // tamaño real ya renderizado, sin que este archivo tenga que adivinar
    // nada) y recién después se la desplaza con un transform relativo al
    // tamaño de LA PANTALLA (no al de la caja): mover posX un punto mueve la
    // caja exactamente ese 1% del ancho de pantalla, sin importar qué tan
    // grande sea la caja de esa plantilla en particular. De paso evita el
    // quirk de padding-top (siempre relativo al ANCHO, nunca al alto, ver
    // paddingTopDesdeY) — translateY en % sí es relativo al alto real.
    estilo.justifyContent = 'center';
    estilo.alignItems = 'center';
    transformas.push(`translate(${config.posX - 50}%, ${config.posY - 50}%)`);
  }

  const escala = Number(config?.escala) || 1;
  // Ensanchar/alargar: multiplican la escala general en un solo eje —
  // dejalos en 100% y se comporta exactamente como antes (scale uniforme).
  const estiramientoAncho = (Number(config?.estiramientoAncho) || 100) / 100;
  const estiramientoAlto = (Number(config?.estiramientoAlto) || 100) / 100;
  const scaleX = escala * estiramientoAncho;
  const scaleY = escala * estiramientoAlto;
  if (scaleX !== 1 || scaleY !== 1) {
    transformas.push(`scale(${scaleX}, ${scaleY})`);
    if (!tienePosicion) {
      // Sin posición tocada a mano, la caja sigue en el lugar por defecto de
      // CADA plantilla (su propio CSS — la mayoría "abajo al centro", no el
      // centro de la pantalla) — para que agrandar/achicar no la corra de
      // ahí, el origen del escalado apunta aproximadamente a ese lugar
      // (mismo respaldo de siempre). Con posición sí tocada no hace falta
      // nada de esto: la caja ya quedó centrada por flexbox ANTES del
      // transform, así que el origen por defecto (50% 50% del contenedor de
      // pantalla completa) ya coincide exactamente con el centro real de la
      // caja.
      estilo.transformOrigin = '50% 88%';
    }
  }

  if (transformas.length > 0) estilo.transform = transformas.join(' ');

  return estilo;
}

// Ubicación en pantalla para Nómina/Estadísticas — a diferencia del
// marcador (una caja chica que se arrastra a un punto libre), estas son
// pantallas completas con varios elementos adentro, así que en vez de X/Y
// libre se ofrecen posiciones típicas (igual de "independiente" cada una,
// pero sin arriesgarse a descuadrar un layout de varias columnas).
const UBICACIONES = {
  centro: { alignItems: 'center', justifyContent: 'center' },
  arriba: { alignItems: 'flex-start', justifyContent: 'center' },
  abajo: { alignItems: 'flex-end', justifyContent: 'center' },
  izquierda: { alignItems: 'center', justifyContent: 'flex-start' },
  derecha: { alignItems: 'center', justifyContent: 'flex-end' },
};
export const estiloUbicacion = (valor) => UBICACIONES[valor] || UBICACIONES.centro;

// Cada plantilla de marcador pertenece a una "familia visual" — agrupa
// plantillas de estética emparentada para que Nómina/Estadísticas/Anuncios
// tengan una identidad (tipografía, animación de entrada, forma) coherente
// con el marcador elegido, en vez de un único diseño genérico reciclado
// para las 25 plantillas.
const FAMILIA_POR_PLANTILLA = {
  clasico: 'clasico', ncaa: 'clasico', 'championship-gold': 'clasico', 'euro-divider': 'clasico', 'anillo-campeones': 'clasico',
  nba: 'broadcast', ticker: 'broadcast', 'espn-ticker': 'broadcast', 'lower-third': 'broadcast', 'broadcast-bonus': 'broadcast', 'fiba-broadcast': 'broadcast',
  neon: 'neon', 'arena-glow': 'neon', 'retro-led': 'neon', 'gradient-wave': 'neon',
  street: 'streetball', split: 'streetball', 'slant-dynamic': 'streetball', 'outline-bold': 'streetball', 'compacto-tofo': 'streetball', 'record-block': 'streetball',
  minimal: 'cristal', 'corner-min': 'cristal', glass: 'cristal', 'card-stack': 'cristal', 'circle-focus': 'cristal', 'pildora-doble': 'cristal',
  'halo-digital': 'holografico',
  'diario-deportivo': 'editorial',
  'tablero-madera': 'madera',
  'hud-tactico': 'tactico',
  // Sistemas con identidad completa propia (ver temasSistemas.css).
  brutalista: 'sx-brutalista', 'sticker-pop': 'sx-sticker',
  suizo: 'sx-suizo',
  'torre-lateral': 'sx-torre', momentum: 'sx-momentum',
  'media-cancha': 'sx-cancha',
  terminal: 'sx-terminal',
  'crossover': 'sx-crossover',
  'foco-arena': 'sx-foco',
  'pizarra-tactica': 'sx-pizarra',
  'ticket-recibo': 'sx-ticket',
  'cromo-coleccionable': 'sx-cromo',
  'metro': 'sx-metro',
  'tablero-paletas': 'sx-paletas',
  'afiche-riso': 'sx-riso',
  'noventero': 'sx-noventero',
  'pulso-partido': 'sx-pulso',
  'foto-protagonista': 'sx-foto',
  'gran-titular': 'sx-titular',
  'apilado-reacciones': 'sx-reacciones',
  'modular': 'sx-modular',
  'escudo-torneo': 'sx-torneo',
  'alas-trapecio': 'sx-trapecio',
  'cartel-rasgado': 'sx-grunge',
  'creador-libre': 'clasico',
};

// Variantes de un diseño (p. ej. dos "Clásico" para dos ligas distintas):
// su plantilla_base es `<base>~v<sufijo>` — cada una tiene su propia fila,
// su enlace de OBS y su config, pero se dibuja con la plantilla <base>.
export const idBasePlantilla = (id) => (typeof id === 'string' ? id.split('~v')[0] : id);
export const esVariante = (id) => typeof id === 'string' && id.includes('~v');
export const nuevoIdVariante = (id) => `${idBasePlantilla(id)}~v${Date.now().toString(36)}`;

export const familiaDePlantilla = (plantillaId) => FAMILIA_POR_PLANTILLA[idBasePlantilla(plantillaId)] || 'clasico';

// La tipografía de cada plantilla de marcador está fija en su propio bloque
// de plantillas.css (`font-family: var(--pm-fuente, 'X')`) — este mapa
// espeja esos mismos valores para que Nómina/Estadísticas/Anuncios puedan
// fijar la MISMA variable `--pm-fuente` y así todo el diseño (tablero +
// resto) use un solo tipo de letra, en vez de que cada pantalla traiga la
// suya propia (antes Nómina/Anuncios usaban la fuente "de familia", que
// podía no coincidir con la del marcador puntual elegido).
const FUENTE_POR_PLANTILLA = {
  clasico: "'Orbitron', sans-serif",
  nba: "'Oswald', sans-serif",
  ncaa: "'Bebas Neue', sans-serif",
  minimal: 'system-ui, sans-serif',
  neon: "'Orbitron', sans-serif",
  street: "'Bungee', sans-serif",
  ticker: "'Barlow Condensed', sans-serif",
  'corner-min': "'Oswald', sans-serif",
  split: "'Rajdhani', sans-serif",
  glass: 'system-ui, sans-serif',
  'arena-glow': "'Russo One', sans-serif",
  'championship-gold': "'Cinzel', serif",
  'espn-ticker': "'Anton', sans-serif",
  'slant-dynamic': "'Teko', sans-serif",
  'retro-led': "'Courier New', monospace",
  'card-stack': "'Poppins', sans-serif",
  'gradient-wave': "'Exo 2', sans-serif",
  'outline-bold': "'Bebas Neue', sans-serif",
  'circle-focus': "'Titillium Web', sans-serif",
  'lower-third': "'Titillium Web', sans-serif",
  'euro-divider': "'Rajdhani', sans-serif",
  'broadcast-bonus': "'Anton', sans-serif",
  'compacto-tofo': "'Barlow Condensed', sans-serif",
  'record-block': "'Russo One', sans-serif",
  'pildora-doble': "'Poppins', sans-serif",
  'fiba-broadcast': "'Anton', sans-serif",
  'halo-digital': "'Exo 2', sans-serif",
  'diario-deportivo': "'Cinzel', serif",
  'anillo-campeones': "'Cinzel', serif",
  'tablero-madera': "'Oswald', sans-serif",
  'hud-tactico': "'Rajdhani', sans-serif",
  brutalista: "'Dela Gothic One', sans-serif",
  suizo: "'Inter Tight', sans-serif",
  'torre-lateral': "'Big Shoulders Display', sans-serif",
  momentum: "'Space Grotesk', sans-serif",
  'media-cancha': "'Unbounded', sans-serif",
  'sticker-pop': "'Lilita One', sans-serif",
  terminal: "'JetBrains Mono', monospace",
  'crossover': "'Barlow Condensed', sans-serif",
  'foco-arena': "'Chakra Petch', sans-serif",
  'pizarra-tactica': "'Permanent Marker', cursive",
  'ticket-recibo': "'Big Shoulders Stencil Display', sans-serif",
  'cromo-coleccionable': "'Alfa Slab One', serif",
  'metro': "'Overpass', sans-serif",
  'tablero-paletas': "'Share Tech Mono', monospace",
  'afiche-riso': "'Archivo Black', sans-serif",
  'noventero': "'Bowlby One', sans-serif",
  'pulso-partido': "'IBM Plex Sans Condensed', sans-serif",
  'foto-protagonista': "'League Gothic', sans-serif",
  'gran-titular': "'Saira Extra Condensed', sans-serif",
  'apilado-reacciones': "'Bricolage Grotesque', sans-serif",
  'modular': "'Kanit', sans-serif",
  'escudo-torneo': "'Outfit', sans-serif",
  'alas-trapecio': "'Michroma', sans-serif",
  'cartel-rasgado': "'Rubik Dirt', sans-serif",
  'creador-libre': "'Oswald', sans-serif",
};

export const fuenteDePlantilla = (plantillaId) => FUENTE_POR_PLANTILLA[idBasePlantilla(plantillaId)] || "'Oswald', sans-serif";

// Catálogo de tipografías elegibles a mano (config.fuenteMarcador) — todas
// las familias de Google Fonts que carga plantillas.css (las 13 de las 34
// plantillas de fábrica, más otras 15 sumadas solo para tener variedad acá
// en el selector), más 'Courier New' y 'system-ui', del sistema. Elegir
// cualquiera de acá no depende de qué plantilla esté activa: todas están
// cargadas siempre.
export const FUENTES_DISPONIBLES = [
  { id: '', etiqueta: 'Automática (la de la plantilla)' },
  { id: "'Inter Tight', sans-serif", etiqueta: 'Inter Tight — suiza, editorial' },
  { id: "'Dela Gothic One', sans-serif", etiqueta: 'Dela Gothic One — maciza, ancha' },
  { id: "'League Gothic', sans-serif", etiqueta: 'League Gothic — alta y angosta' },
  { id: "'Michroma', sans-serif", etiqueta: 'Michroma — techno extendida' },
  { id: "'Overpass', sans-serif", etiqueta: 'Overpass — señalética vial' },
  { id: "'Kanit', sans-serif", etiqueta: 'Kanit — deportiva geométrica' },
  { id: "'Big Shoulders Stencil Display', sans-serif", etiqueta: 'Big Shoulders Stencil — esténcil' },
  { id: "'Rubik Dirt', sans-serif", etiqueta: 'Rubik Dirt — gastada, grunge' },
  { id: "'Space Grotesk', sans-serif", etiqueta: 'Space Grotesk — moderna, técnica' },
  { id: "'Unbounded', sans-serif", etiqueta: 'Unbounded — ancha, redonda' },
  { id: "'Lilita One', sans-serif", etiqueta: 'Lilita One — pop, juvenil' },
  { id: "'JetBrains Mono', monospace", etiqueta: 'JetBrains Mono — monoespaciada' },
  { id: "'Orbitron', sans-serif", etiqueta: 'Orbitron — digital, angulosa' },
  { id: "'Oswald', sans-serif", etiqueta: 'Oswald — condensada, prolija' },
  { id: "'Bebas Neue', sans-serif", etiqueta: 'Bebas Neue — grande, impactante' },
  { id: "'Anton', sans-serif", etiqueta: 'Anton — extra gruesa' },
  { id: "'Bungee', sans-serif", etiqueta: 'Bungee — street, con relieve' },
  { id: "'Bungee Shade', sans-serif", etiqueta: 'Bungee Shade — street, sombra 3D' },
  { id: "'Barlow Condensed', sans-serif", etiqueta: 'Barlow Condensed — angosta, moderna' },
  { id: "'Rajdhani', sans-serif", etiqueta: 'Rajdhani — técnica, futurista' },
  { id: "'Russo One', sans-serif", etiqueta: 'Russo One — sólida, arcade' },
  { id: "'Teko', sans-serif", etiqueta: 'Teko — muy angosta, alta' },
  { id: "'Poppins', sans-serif", etiqueta: 'Poppins — redondeada, amable' },
  { id: "'Cinzel', serif", etiqueta: 'Cinzel — clásica, con serifa' },
  { id: "'Cinzel Decorative', serif", etiqueta: 'Cinzel Decorative — ornamentada, de trofeo' },
  { id: "'Playfair Display', serif", etiqueta: 'Playfair Display — elegante, premium' },
  { id: "'Titillium Web', sans-serif", etiqueta: 'Titillium Web — limpia, corporativa' },
  { id: "'Exo 2', sans-serif", etiqueta: 'Exo 2 — geométrica, sci-fi' },
  { id: "'Archivo Black', sans-serif", etiqueta: 'Archivo Black — gruesa, directa' },
  { id: "'Staatliches', sans-serif", etiqueta: 'Staatliches — cartel, alta' },
  { id: "'Black Ops One', sans-serif", etiqueta: 'Black Ops One — militar, stencil' },
  { id: "'Audiowide', sans-serif", etiqueta: 'Audiowide — futurista, ancha' },
  { id: "'Racing Sans One', sans-serif", etiqueta: 'Racing Sans One — motorsport, inclinada' },
  { id: "'Squada One', sans-serif", etiqueta: 'Squada One — redondeada, arcade' },
  { id: "'Alfa Slab One', serif", etiqueta: 'Alfa Slab One — slab, muy pesada' },
  { id: "'Passion One', sans-serif", etiqueta: 'Passion One — condensada, bold' },
  { id: "'Fjalla One', sans-serif", etiqueta: 'Fjalla One — titular condensado' },
  { id: "'Big Shoulders Display', sans-serif", etiqueta: 'Big Shoulders Display — condensada editorial' },
  { id: "'Monoton', sans-serif", etiqueta: 'Monoton — neón retro, solo mayúsculas' },
  { id: "'Press Start 2P', monospace", etiqueta: 'Press Start 2P — pixel arcade' },
  { id: "'Courier New', monospace", etiqueta: 'Courier New — máquina de escribir' },
  { id: 'system-ui, sans-serif', etiqueta: 'Del sistema — minimalista' },
];

// Fuente efectiva de un diseño: la elegida a mano en Personalizar diseño
// (config.fuenteMarcador) si hay una, o si no la propia de la plantilla
// (fuenteDePlantilla) — así "Automática" (el valor por defecto, cadena
// vacía) preserva el look de autor de cada plantilla tal cual estaba.
export const fuenteEfectiva = (config, plantillaId) => config?.fuenteMarcador || fuenteDePlantilla(plantillaId);

// Colores/tamaños/tipografía PROPIOS de una capa (Nómina/Estadísticas/
// Anuncios), independientes de los del marcador (--pm-*) — mismo patrón
// para las tres, un solo lugar. `prefijo` es 'nomina'/'estadisticas'/
// 'anuncios': lee config[`${prefijo}ColorFondo`] etc. y arma las variables
// `--${prefijo}-fondo`/`-texto`/`-titulo`/`-escala-texto`/`-escala-titulo`/
// `-titulo-fuente`/`-titulo-peso`/`-escala-general`. Sin elegir nada a
// mano, el CSS de cada capa sigue cayendo en var(--pm-tablero, ...) como
// respaldo (ver cada hoja de estilos) — este helper solo agrega la
// propiedad cuando el usuario eligió algo puntual, nunca fuerza un valor
// por las suyas. `-escala-general` es el equivalente, por capa, del
// "Tamaño general" del marcador (config.escala): agranda/achica el bloque
// entero (caja + letras + todo junto) vía la propiedad CSS `scale`, no
// solo el tamaño de fuente — eso lo sigue resolviendo `-escala-texto`.
export function estiloTemaCapa(config, prefijo) {
  const estilo = {};
  const fondo = config?.[`${prefijo}ColorFondo`];
  const texto = config?.[`${prefijo}ColorTexto`];
  const titulo = config?.[`${prefijo}ColorTitulo`];
  if (fondo) estilo[`--${prefijo}-fondo`] = hexConAlpha(fondo, config?.[`${prefijo}ColorFondoAlpha`]);
  if (texto) estilo[`--${prefijo}-texto`] = hexConAlpha(texto, config?.[`${prefijo}ColorTextoAlpha`]);
  if (titulo) estilo[`--${prefijo}-titulo`] = hexConAlpha(titulo, config?.[`${prefijo}ColorTituloAlpha`]);
  const escalaGeneral = Number.isFinite(config?.[`${prefijo}Escala`]) ? config[`${prefijo}Escala`] / 100 : 1;
  const escalaTexto = Number.isFinite(config?.[`${prefijo}TamanoTexto`]) ? config[`${prefijo}TamanoTexto`] / 100 : 1;
  const escalaTitulo = Number.isFinite(config?.[`${prefijo}TamanoTitulo`]) ? config[`${prefijo}TamanoTitulo`] / 100 : 1;
  estilo[`--${prefijo}-escala-general`] = escalaGeneral;
  estilo[`--${prefijo}-escala-texto`] = escalaTexto;
  estilo[`--${prefijo}-escala-titulo`] = escalaTitulo;
  if (config?.[`${prefijo}TituloFuente`]) estilo[`--${prefijo}-titulo-fuente`] = config[`${prefijo}TituloFuente`];
  // Sin elegir, cada capa queda con la negrita propia de su diseño (ver NEGRITA_POR_DEFECTO en el panel).
  if (typeof config?.[`${prefijo}TituloNegrita`] === 'boolean') estilo[`--${prefijo}-titulo-peso`] = config[`${prefijo}TituloNegrita`] ? 800 : 400;
  return estilo;
}

// Familia visual efectiva de una capa: la elegida a mano
// (config[`${prefijo}EstiloAnimacion`]) si hay una, o si no la de la
// plantilla de marcador — mismo criterio que ya usaba Anuncios
// (alertaAnimacion), ahora factorizado para reusarlo en Nómina y
// Estadísticas también.
export function familiaEfectiva(config, prefijo, plantillaId) {
  return config?.[`${prefijo}EstiloAnimacion`] || familiaDePlantilla(plantillaId);
}

// `modoAlerta` define cómo entra una jugada/falta en la escena de Anuncios
// respecto al marcador: 'arriba' la agrega como una franja encima de él
// (el marcador se sigue viendo debajo, sin taparlo); 'superpone' la hace
// aparecer justo sobre el área del marcador — como si la acción "tomara"
// el marcador por un instante — y al terminar la animación vuelve a verse
// solo el marcador (que nunca se ocultó: son dos capas de OBS distintas).
export const FAMILIAS_VISUALES = {
  clasico: { modoAlerta: 'arriba' },
  broadcast: { modoAlerta: 'superpone' },
  neon: { modoAlerta: 'superpone' },
  streetball: { modoAlerta: 'arriba' },
  cristal: { modoAlerta: 'arriba' },
  holografico: { modoAlerta: 'superpone' },
  editorial: { modoAlerta: 'arriba' },
  madera: { modoAlerta: 'arriba' },
  tactico: { modoAlerta: 'superpone' },
};

// Ancla la escena de Anuncios EXACTAMENTE al borde de la caja del marcador
// (izquierdo/derecho/superior, según el modo) — no "cerca", pegado — para
// que se pueda ver como una pestaña que sale directamente de la caja, no
// como un cartel flotando aparte. El punto devuelto acá es solo el ANCLA;
// quién queda centrado/hacia qué lado "cuelga" lo resuelve un transform fijo
// en CSS (.anuncios-ancla), independiente del tamaño real del texto — así
// la pestaña queda pegada sea cual sea el largo del aviso.
//
// 'costado' usa `lado` ('izquierda'/'derecha'), decidido por qué EQUIPO hizo
// la jugada (local → izquierda, visita → derecha) — no por dónde esté el
// marcador en la pantalla. 'arriba' sale como pestaña desde el borde
// superior de la caja. 'superpone' se centra sobre la caja (la "toma" un
// instante). Los tres modos los puede fijar el usuario a mano
// (config.alertaPosicion) o, si no eligió ninguno, se usa el que le
// corresponde a la familia visual del diseño.
//
// `caja` (opcional, de useCajaMarcador): la caja YA RENDERIDA, medida de
// verdad — cuando está disponible, se usa en vez de posX/posY +
// mitadCajaProporcional (una aproximación fija que asume un tamaño típico
// de caja). Antes, con un diseño con logo/fuente/escala fuera de lo
// "típico", la aproximación quedaba corrida del borde real de la caja —
// ningún ajuste de tamaño o posición del AVISO podía corregir eso, porque
// el problema estaba en el ANCLA, no en el aviso — el aviso "se veía mal"
// sin importar qué se tocara. Con la caja real, el ancla queda pegada al
// borde de verdad sea cual sea la plantilla/tamaño/logo/fuente.
export function estiloAnclaAlerta(tema = {}, modo = 'arriba', lado = 'izquierda', caja = null) {
  const posX = caja ? caja.left + caja.width / 2 : (Number.isFinite(tema?.posX) ? tema.posX : 50);
  const posY = caja ? caja.topAlto + caja.heightAlto / 2 : (Number.isFinite(tema?.posY) ? tema.posY : 88);
  const mitad = caja ? { x: caja.width / 2, y: caja.heightAlto / 2 } : mitadCajaProporcional(tema);

  // 'libre': el usuario elige un punto propio (anunciosX/Y), como con el
  // marcador — sin depender de dónde esté la caja ni de su tamaño. Mismo
  // criterio que 'costado' (la jugada del equipo LOCAL sale del lado
  // izquierdo de ese punto, la del VISITA del lado derecho) para no perder
  // esa lectura ("de qué lado jugó cada uno") solo porque la posición ahora
  // es libre en vez de estar atada al marcador.
  if (modo === 'libre') {
    const libreX = Number.isFinite(tema?.anunciosX) ? tema.anunciosX : 50;
    const libreY = Number.isFinite(tema?.anunciosY) ? tema.anunciosY : 15;
    const separacionLibre = 4;
    const x = lado === 'derecha' ? Math.min(100, libreX + separacionLibre) : Math.max(0, libreX - separacionLibre);
    return {
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      paddingLeft: `${x}%`,
      paddingTop: paddingTopDesdeY(libreY),
    };
  }

  if (modo === 'costado') {
    const x = lado === 'derecha' ? Math.min(100, posX + mitad.x) : Math.max(0, posX - mitad.x);
    return {
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      paddingLeft: `${x}%`,
      paddingTop: paddingTopDesdeY(posY),
    };
  }

  if (modo === 'superpone') {
    return {
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      paddingLeft: `${posX}%`,
      paddingTop: paddingTopDesdeY(posY),
    };
  }

  // 'arriba': pegada al borde superior de la caja, centrada (sin que el
  // aviso, que se centra en ese punto, se salga por los costados).
  return {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: `${Math.min(84, Math.max(16, posX))}%`,
    paddingTop: paddingTopDesdeY(Math.max(0, posY - mitad.y)),
  };
}

// Ancla el "+N" que aparece al anotar. Tres modos elegibles desde el diseño
// (config.animacionPuntosPosicion):
// - 'costado' (por defecto): pegado al costado del marcador — izquierda
//   para local, derecha para visita, coherente con la convención de todo el
//   proyecto. Local usa flex-end (el texto CRECE hacia la izquierda desde
//   su ancla) y visita usa flex-start (crece hacia la derecha) — así los
//   dos lados quedan SIEMPRE afuera de la caja sea cual sea el largo del
//   texto ("+1!!" vs "+3!!"), en vez de una ancla fija que a un lado le
//   quedaba muy lejos (se veía "perdido" fuera del tablero) y al otro muy
//   cerca (se veía metido adentro del marcador).
// - 'arriba': arriba del marcador, un poco separado hacia cada costado.
// - 'centro': centro de la pantalla, sin relación con la caja.
// `caja` (opcional, real, medida): mismo reemplazo de la aproximación fija
// que en estiloAnclaAlerta/estiloAnclaLogo — no se usa en 'centro'/'libre'
// (no dependen de la caja).
export function estiloAnclaPop(tema = {}, lado, posicion = 'costado', caja = null) {
  const posX = caja ? caja.left + caja.width / 2 : (Number.isFinite(tema?.posX) ? tema.posX : 50);
  const posY = caja ? caja.topAlto + caja.heightAlto / 2 : (Number.isFinite(tema?.posY) ? tema.posY : 88);
  const mitad = caja ? { x: caja.width / 2, y: caja.heightAlto / 2 } : mitadCajaProporcional(tema);
  // Distancia en espejo (px sobre el lienzo de 1920): positivo aleja los dos
  // lados del tablero (o del punto libre), negativo los acerca.
  const extra = (Number(tema?.animacionPuntosSeparacion) || 0) / 19.2;

  if (posicion === 'centro') {
    return { justifyContent: 'center', alignItems: 'center', paddingLeft: 0, paddingTop: 0 };
  }

  // 'libre': el usuario elige un punto propio (animacionPuntosX/Y), sin
  // depender de dónde esté el marcador ni de su tamaño — a diferencia de
  // 'costado'/'arriba' (calculados relativos a la caja del marcador, así que
  // mover el marcador también corre la animación), acá el punto es fijo. Los
  // dos lados quedan separados por una distancia chica y pareja a los costados
  // de ese punto — mismo patrón visual que 'costado', centrado en el punto
  // elegido en vez del borde del marcador.
  if (posicion === 'libre') {
    const libreX = Number.isFinite(tema?.animacionPuntosX) ? tema.animacionPuntosX : 50;
    const libreY = Number.isFinite(tema?.animacionPuntosY) ? tema.animacionPuntosY : 50;
    const separacionLibre = Math.max(0, 6 + extra);
    const y = paddingTopDesdeY(Math.max(0, libreY - 4));
    if (lado === 'visita') {
      const x = Math.min(98, libreX + separacionLibre);
      return { justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: `${x}%`, paddingTop: y };
    }
    const x = Math.max(2, libreX - separacionLibre);
    return { justifyContent: 'flex-end', alignItems: 'flex-start', paddingRight: `${100 - x}%`, paddingTop: y };
  }

  if (posicion === 'arriba') {
    const arribaY = paddingTopDesdeY(Math.max(0, posY - mitad.y - 16));
    if (lado === 'visita') {
      const x = Math.min(98, posX + Math.max(0, 6 + extra));
      return { justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: `${x}%`, paddingTop: arribaY };
    }
    const x = Math.max(2, posX - Math.max(0, 6 + extra));
    return { justifyContent: 'flex-end', alignItems: 'flex-start', paddingRight: `${100 - x}%`, paddingTop: arribaY };
  }

  // 'costado': separación idéntica de los dos lados respecto al borde real
  // de la caja, y cada uno crece "hacia afuera" (nunca hacia el marcador).
  const separacion = Math.max(0, mitad.x + 3 + extra);
  const costadoY = paddingTopDesdeY(Math.max(0, posY - mitad.y - 4));
  if (lado === 'visita') {
    const x = Math.min(98, posX + separacion);
    return { justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: `${x}%`, paddingTop: costadoY };
  }
  const x = Math.max(2, posX - separacion);
  return { justifyContent: 'flex-end', alignItems: 'flex-start', paddingRight: `${100 - x}%`, paddingTop: costadoY };
}

// Los toggles (mostrarFaltas/mostrarPosesion/mostrarLogo) son opt-out: si no
// vienen en la config (diseño no personalizado, o venía de antes de que
// existiera esta opción) se muestran por defecto.
export const mostrar = (config, clave) => config?.[clave] !== false;
// El escudo va DENTRO del tablero solo con la posición 'costado'; las demás
// (arriba/abajo/costados/fondo/libre) lo dibujan LogoFlotante/LogoMarcaAgua.
export const logoAdentro = (config) => mostrar(config, 'mostrarLogo') && (config?.logoPosicion || 'costado') === 'costado';

// Cómo se leen las faltas en el tablero: número (comportamiento de siempre),
// puntos o líneas tipo tarja — capado para no desbordar la caja si el
// partido acumula muchas faltas (el número real sigue contando aparte, acá
// solo cambia cómo se dibuja).
const CASILLAS_FALTAS = 5;
export function indicadorFaltas(cantidad, estilo) {
  const n = Math.max(0, Number(cantidad) || 0);
  if (estilo === 'puntos' || estilo === 'lineas') {
    // 'lineas' (id histórico) = guiones medios, como los tableros profesionales.
    // 5 casillas fijas (llenas/vacías, el ancho no salta); FIBA da bonus a la 4.ª.
    const [lleno, vacio, sep] = estilo === 'puntos' ? ['●', '○', ' '] : ['▰', '▱', ''];
    const casillas = Array.from({ length: CASILLAS_FALTAS }, (_, i) => (i < n ? lleno : vacio)).join(sep);
    return n > CASILLAS_FALTAS ? `${casillas}+${n - CASILLAS_FALTAS}` : casillas;
  }
  return String(n);
}

// Como usePulso, pero además captura CUÁNTO subió el valor — para el "+N!!"
// que aparece al anotar. Solo dispara con incrementos (subidas); una
// corrección hacia abajo (o el reset de PUNTOS_CORREGIR) no muestra nada.
export function usePulsoConDelta(valor) {
  const anteriorRef = useRef(valor);
  const [estado, setEstado] = useState({ pulso: false, delta: 0, clave: 0 });

  useEffect(() => {
    const anterior = anteriorRef.current;
    anteriorRef.current = valor;
    const delta = valor - anterior;
    if (delta > 0) {
      setEstado((e) => ({ pulso: true, delta, clave: e.clave + 1 }));
      const temporizador = setTimeout(() => setEstado((e) => ({ ...e, pulso: false })), 900);
      return () => clearTimeout(temporizador);
    }
    return undefined;
  }, [valor]);

  return estado;
}

export function usePulso(valor) {
  const anterior = useRef(valor);
  const [pulso, setPulso] = useState(false);

  useEffect(() => {
    if (anterior.current !== valor) {
      anterior.current = valor;
      setPulso(true);
      const t = setTimeout(() => setPulso(false), 650);
      return () => clearTimeout(t);
    }
  }, [valor]);

  return pulso;
}

// Reloj con décimas en el último minuto ("mayor seriedad" para el momento
// más tenso del período). El servidor sigue mandando `relojSegundos` una
// vez por segundo (ya redondeado — ver relojActual en el backend), así que
// ESE valor por sí solo no alcanza para un conteo suave entre tick y tick.
// Junto con el tick de 1s, el backend también manda `relojSegundosBase`
// (el entero del que partió ese tramo) y `relojReferenciaEn` (cuándo
// arrancó/retomó ese tramo) — con esos dos, acá se recalcula el tiempo
// restante EXACTO en cada frame (requestAnimationFrame), igual que hace el
// propio backend para `relojActual()` pero sin el Math.floor.
// Fuera del último minuto se devuelve tal cual `partido.relojSegundos`
// (entero, sin ningún trabajo extra) — por eso el bucle de animación entero
// solo corre durante esos últimos 60s de cada período, no el partido entero.
// Reloj interpolado en el cliente: el servidor manda un estado por segundo,
// pero el reloj REAL corre continuo — sin esto, la pantalla quedaba atada a
// la fase de ese tick (hasta ~1 s atrasada, y "tardaba en arrancar" al dar
// play). Corre desde la referencia exacta (relojSegundosBase +
// relojReferenciaEn) y corrige la diferencia entre la hora de ESTE
// dispositivo y la del servidor (servidorAhora): un celular o una PC con la
// hora corrida unos segundos ya no desfasa el reloj. Devuelve entero
// (mm:ss) arriba del minuto y con décimas en el último minuto.
const desfasesServidor = { valor: null };
function registrarDesfase(servidorAhora) {
  if (!Number.isFinite(servidorAhora)) return;
  // La latencia de red solo puede hacerlo parecer MENOR: vale el máximo.
  const muestra = servidorAhora - Date.now();
  if (desfasesServidor.valor == null || muestra > desfasesServidor.valor || Math.abs(muestra - desfasesServidor.valor) > 5000) {
    desfasesServidor.valor = muestra;
  }
}

// Interpola un reloj que corre hacia atrás desde (base, referencia) — usado
// por el reloj de juego y por el de posesión. Por debajo de `umbralDecimales`
// devuelve fracción (décimas); arriba, entero.
function useInterpolado(base, referenciaEn, corriendo, valorQuieto, umbralDecimales) {
  const activo = corriendo && Number.isFinite(base) && referenciaEn;
  const [preciso, setPreciso] = useState(null);
  useEffect(() => {
    if (!activo) { setPreciso(null); return undefined; }
    const refMs = new Date(referenciaEn).getTime();
    const calcular = () => Math.max(0, base - (Date.now() + (desfasesServidor.valor || 0) - refMs) / 1000);
    let id;
    const tick = () => {
      const v = calcular();
      setPreciso(v);
      // Con décimas: cada 50 ms. Si no, justo cuando cambia el segundo.
      const espera = v < umbralDecimales + 1 ? 50 : Math.max(20, (v - Math.floor(v)) * 1000 + 15);
      id = setTimeout(tick, espera);
    };
    tick();
    return () => clearTimeout(id);
  }, [activo, referenciaEn, base, umbralDecimales]);
  if (!activo || preciso == null) return valorQuieto;
  return preciso < umbralDecimales ? preciso : Math.floor(preciso + 1e-6);
}

// Reloj de juego interpolado en el cliente (OBS, Mesa): corre continuo desde
// la referencia exacta, corrigiendo la diferencia de hora con el servidor.
// Entero arriba del minuto, con décimas en el último minuto.
export function useRelojVivo(partido) {
  registrarDesfase(partido?.servidorAhora);
  const base = Number.isFinite(partido?.relojSegundosBase) ? partido.relojSegundosBase : partido?.relojSegundos;
  return useInterpolado(base, partido?.relojReferenciaEn, Boolean(partido?.relojCorriendo), partido?.relojSegundos, 60);
}

// Reloj de posesión (24"): décimas en los últimos 5 segundos (FIBA).
export function useRelojPosesion(partido) {
  registrarDesfase(partido?.servidorAhora);
  const base = Number.isFinite(partido?.posesionSegundosBase) ? partido.posesionSegundosBase : partido?.posesionSegundos;
  return useInterpolado(base, partido?.posesionReferenciaEn, Boolean(partido?.posesionCorriendo), partido?.posesionSegundos ?? 24, 5);
}

export const formatearPosesion = (v) => {
  const n = Math.max(0, Number(v) || 0);
  if (n < 5 && !Number.isInteger(n)) return (Math.floor(n * 10) / 10).toFixed(1);
  return String(Math.floor(n));
};

// `patrocinadores` llega dentro de cada broadcast 'estado' (cada segundo
// mientras el reloj corre), así que su referencia cambia todo el tiempo
// aunque la lista sea la misma. El timer de rotación depende solo de un
// string estable con los ids (clavesLista) y de un ref para leer la lista
// vigente, para no reiniciarse en cada broadcast y nunca llegar a rotar.
export function usePatrocinadorActual(patrocinadores) {
  const listaRef = useRef(patrocinadores || []);
  listaRef.current = patrocinadores || [];
  const [indice, setIndice] = useState(0);
  const clavesLista = (patrocinadores || []).map((p) => p.id).join(',');

  useEffect(() => {
    setIndice(0);
  }, [clavesLista]);

  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || lista.length === 0) return undefined;
    const actual = lista[indice % lista.length];
    const duracionMs = Math.max(2, Number(actual?.duracion_segundos) || 8) * 1000;
    const temporizador = setTimeout(() => setIndice((i) => i + 1), duracionMs);
    return () => clearTimeout(temporizador);
  }, [indice, clavesLista]);

  const lista = patrocinadores || [];
  if (lista.length === 0) return null;
  return lista[indice % lista.length];
}

// Mide el tamaño/posición REAL de la caja del marcador ya renderizada, en
// vez de estimarla con la fórmula aproximada de mitadCajaProporcional — esa
// aproximación usa una sola constante para las 25 plantillas, así que para
// las que son bastante más altas de lo normal (con nombres, faltas, logos,
// etc.) se quedaba corta y el título terminaba superpuesto con el reloj en
// vez de quedar pegado justo arriba de la caja.
//
// Las 25 plantillas comparten la clase ".plantilla-marcador" en su elemento
// raíz — pero ESE elemento es a propósito position:fixed;inset:0 (ocupa toda
// la pantalla: es el contenedor flex que usa estiloPersonalizado para ubicar
// la caja adentro con padding), no la caja visible en sí. En las 25
// plantillas la caja/barra que se ve de verdad es siempre el PRIMER hijo
// (así están escritas, sea cual sea su nombre de clase puntual: .pc-caja,
// .pn-barra, .pcb-caja, etc.) — se mide ESE, nunca se tocan los archivos de
// plantilla. `top`/`left`/`width`/`height` salen expresados como % del ANCHO
// del contenedor: así se usan directo en paddingLeft/paddingTop sin
// conversión aparte — padding (en cualquiera de sus 4 lados) en CSS SIEMPRE
// se calcula sobre el ancho del contenedor, nunca sobre su alto.
//
// OJO: eso NO aplica a las propiedades top/height (a secas, sin "padding-")
// de un elemento position:fixed/absolute — esas sí se calculan cada una
// sobre su propio eje (top/height sobre el ALTO del contenedor, left/width
// sobre el ancho) — por eso `topAlto`/`heightAlto` viajan aparte, en esa
// otra unidad, para quien necesite anclar con `top`/`height` en vez de
// `padding-top` (como los logos "a los costados": van con `top`/`height`
// porque tienen que estirarse a lo alto de la caja, no colgar de un punto).
// Piezas del tablero donde pueden entrar escudos y nombres: la caja misma si
// tiene fondo propio; si no (p. ej. paneles de color por equipo), el panel
// de cada costado y todas las piezas grandes de la fila.
const tieneFondo = (cs) => cs.backgroundImage !== 'none' || !/^(transparent|rgba\([^)]*,\s*0\))$/.test(cs.backgroundColor);
export const cajaConFondoPropio = (caja) => tieneFondo(getComputedStyle(caja));
export function piezasDeCaja(caja) {
  if (cajaConFondoPropio(caja)) return { propia: true, izquierdaEl: caja, derechaEl: caja, grandesEl: [caja] };
  const altoCaja = caja.getBoundingClientRect().height;
  const piezas = [...caja.querySelectorAll('*')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => r.width > 12 && r.height >= altoCaja * 0.5 && tieneFondo(getComputedStyle(el)));
  if (!piezas.length) return null;
  const area = ({ r }) => r.width * r.height;
  const izquierda = piezas.reduce((a, b) => (b.r.left < a.r.left - 1 || (Math.abs(b.r.left - a.r.left) <= 1 && area(b) > area(a)) ? b : a));
  const derecha = piezas.reduce((a, b) => (b.r.right > a.r.right + 1 || (Math.abs(b.r.right - a.r.right) <= 1 && area(b) > area(a)) ? b : a));
  return {
    propia: false,
    izquierdaEl: izquierda.el, derechaEl: derecha.el,
    // Solo las piezas de primer nivel (no las anidadas dentro de otra pieza).
    grandesEl: piezas.map((p) => p.el).filter((el, _, todas) => !todas.some((o) => o !== el && o.contains(el))),
  };
}

// Paleta REAL del tablero en pantalla: la pieza que contiene el reloj de
// juego (su fondo, textura, borde, esquinas, sombra) y el color/letra de esos
// números. La usan el reloj de 24" y el Intertanto para verse del mismo diseño.
export function paletaDeCaja(caja) {
  const hojas = [...caja.querySelectorAll('*')].filter((el) => el.children.length === 0 && el.textContent.trim() && !el.closest('.lma-capa'));
  const reloj = hojas.find((el) => /\d{1,2}[:.]\d{2}/.test(el.textContent)) || hojas[0] || caja;
  // Sube hasta una pieza con fondo propio y firme (un velo translúcido sobre el tablero no cuenta).
  const alfa = (color) => { const m = color.match(/rgba\([^)]*,\s*([\d.]+)\)/); return m ? Number(m[1]) : 1; };
  let pieza = reloj;
  while (pieza !== caja && !(tieneFondo(getComputedStyle(pieza)) && alfa(getComputedStyle(pieza).backgroundColor) >= 0.5)) pieza = pieza.parentElement;
  const f = getComputedStyle(pieza);
  const t = getComputedStyle(reloj);
  const transparente = /^(transparent|rgba\([^)]*,\s*0\))$/.test(f.backgroundColor);
  return {
    // null = no se impone (la pieza no tiene color propio): queda el del diseño.
    fondo: transparente ? null : f.backgroundColor, textura: f.backgroundImage, radio: f.borderTopLeftRadius, sombra: f.boxShadow,
    borde: parseFloat(f.borderTopWidth) ? `${f.borderTopWidth} ${f.borderTopStyle} ${f.borderTopColor}` : 'none',
    texto: t.color, fuente: t.fontFamily, sombraTexto: t.textShadow,
    // Color de los números grandes (el texto de mayor tamaño: los puntajes).
    numeros: getComputedStyle(hojas.reduce((a, b) => (parseFloat(getComputedStyle(b).fontSize) > parseFloat(getComputedStyle(a).fontSize) ? b : a), reloj)).color,
  };
}

// Colores base de una capa (nómina, estadísticas, anuncios, intertanto): los
// del tablero real en pantalla. Lo elegido a mano (estiloTema/estiloTemaCapa)
// se aplica después y manda.
export function varsPaletaTablero(caja) {
  const p = caja?.paleta;
  if (!p) return {};
  return {
    ...(p.fondo ? { '--pm-tablero': p.fondo } : {}),
    ...(p.texto ? { '--pm-texto': p.texto, '--pm-marcador': p.texto } : {}),
  };
}

// "rgb(r, g, b)" / "rgba(...)" → "#rrggbb" (para los selectores de color).
export function aHex(color) {
  const m = String(color || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? `#${m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : (/^#[0-9a-f]{6}$/i.test(color || '') ? color : null);
}

// Nombre que se ve en el marcador: como máximo 12 caracteres (los diseños
// que usan sigla de 3 letras siguen con la suya). Con config.nombreLargo
// 'completo' se ve entero y, si no entra, se achica la letra (igualarNombres).
export const NOMBRE_MAX_MARCADOR = 12;
// 'completo' (entero, el tablero crece) y 'ajustar' (entero, achicando la
// letra hasta ocupar lo mismo que 12 letras) no cortan el texto.
const nombreSinCortar = (config) => config?.nombreLargo === 'completo' || config?.nombreLargo === 'ajustar';
export const nombreEnMarcador = (nombre, config) => {
  const n = String(nombre || '').trim();
  return nombreSinCortar(config) ? n : n.slice(0, NOMBRE_MAX_MARCADOR);
};
export const conNombresCortos = (partido, config) => (partido && !nombreSinCortar(config) ? {
  ...partido,
  equipoLocal: partido.equipoLocal && { ...partido.equipoLocal, nombre: String(partido.equipoLocal.nombre || '').trim().slice(0, NOMBRE_MAX_MARCADOR) },
  equipoVisita: partido.equipoVisita && { ...partido.equipoVisita, nombre: String(partido.equipoVisita.nombre || '').trim().slice(0, NOMBRE_MAX_MARCADOR) },
} : partido);

// REGLA: un nombre de club largo nunca agranda solo un lado del tablero.
// Busca en la caja los dos textos que son el nombre de cada equipo y les da
// el MISMO ancho (el del más largo, con tope); si uno pasa el tope, se achica
// su letra (hasta 70 %) y recién después se corta con "…".
const TOPE_NOMBRE_PX = 260;
// Los elementos de texto del tablero que son el nombre de cada equipo:
// [locales[], visitas[]]. Ignora las copias que dibuja LogoMarcaAgua (.lma-capa).
export function elementosDeNombres(raiz, nombres) {
  const [a, b] = (nombres || []).map((n) => String(n || '').trim().toLowerCase());
  if (!raiz || !a || !b) return [[], []];
  // Por el texto PROPIO del elemento (sin el de sus hijos): así también se
  // encuentra el nombre cuando va junto a otro detalle (p. ej. la flecha de
  // posesión de Riso: "CULTURA FISICA <span>◄</span>").
  const textoPropio = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim().toLowerCase();
  const candidatos = [...raiz.querySelectorAll('*')].filter((el) => !el.closest('.lma-capa'));
  const de = (n) => candidatos.filter((el) => textoPropio(el) === n);
  const locales = de(a);
  if (a === b) return [locales.filter((_, i) => !(i % 2)), locales.filter((_, i) => i % 2)];
  return [locales, de(b)];
}

// Ancho que ocuparían las primeras 12 letras de ese texto, con su misma letra.
let lienzoMedidas;
function anchoDeDoceLetras(el) {
  const cs = getComputedStyle(el);
  const ctx = (lienzoMedidas ||= document.createElement('canvas')).getContext('2d');
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const texto = el.textContent.trim().slice(0, NOMBRE_MAX_MARCADOR);
  return ctx.measureText(texto).width + (parseFloat(cs.letterSpacing) || 0) * texto.length;
}

export function igualarNombres(raiz, nombres, ajustar = false) {
  const [locales, visitas] = elementosDeNombres(raiz, nombres);
  for (let i = 0; i < Math.min(locales.length, visitas.length); i++) {
    const par = [locales[i], visitas[i]];
    for (const el of par) {
      for (const prop of ['min-width', 'max-width', 'font-size', 'overflow', 'text-overflow', 'white-space', 'text-align']) el.style.removeProperty(prop);
      if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
    }
    for (const el of par) {
      // Si el diseño ya le pone un ancho máximo (o pasa el tope), primero se
      // achica la letra para que el nombre entre completo.
      // "Ajustar": el nombre entero tiene que entrar en el lugar de 12 letras.
      const disponible = Math.min(TOPE_NOMBRE_PX, el.scrollWidth > el.clientWidth + 1 ? el.clientWidth : Infinity, ajustar ? anchoDeDoceLetras(el) : Infinity);
      if (el.scrollWidth > disponible) {
        const base = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${base * Math.max(0.5, disponible / el.scrollWidth)}px`;
      }
    }
    // +2: offsetWidth redondea hacia abajo y medio píxel de menos ya dispara el "…".
    const ancho = Math.min(TOPE_NOMBRE_PX, Math.max(...par.map((el) => el.offsetWidth)) + 2);
    for (const el of par) {
      Object.assign(el.style, { minWidth: `${ancho}px`, maxWidth: `${ancho}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
      // En columna centrada (nombre sobre el puntaje) el texto más corto sigue centrado.
      const padre = getComputedStyle(el.parentElement);
      if (padre.flexDirection === 'column' && padre.alignItems === 'center') el.style.textAlign = 'center';
    }
  }
}

export function useCajaMarcador(contenedorRef, dependencias = [], nombres = null, ajustarNombres = false) {
  const [caja, setCaja] = useState(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return undefined;
    const wrapper = contenedor.querySelector('.plantilla-marcador');
    const elementoCaja = wrapper?.firstElementChild;
    if (!elementoCaja) return undefined;

    if (nombres) igualarNombres(elementoCaja, nombres, ajustarNombres);
    const medir = () => {
      const rectCaja = elementoCaja.getBoundingClientRect();
      const rectContenedor = contenedor.getBoundingClientRect();
      if (rectContenedor.width === 0 || rectCaja.width === 0 || rectContenedor.height === 0) return;
      setCaja({
        top: ((rectCaja.top - rectContenedor.top) / rectContenedor.width) * 100,
        left: ((rectCaja.left - rectContenedor.left) / rectContenedor.width) * 100,
        width: (rectCaja.width / rectContenedor.width) * 100,
        height: (rectCaja.height / rectContenedor.width) * 100,
        topAlto: ((rectCaja.top - rectContenedor.top) / rectContenedor.height) * 100,
        heightAlto: (rectCaja.height / rectContenedor.height) * 100,
        elemento: elementoCaja,
        fondoPropio: cajaConFondoPropio(elementoCaja),
        paleta: paletaDeCaja(elementoCaja),
      });
    };

    medir();
    let vivo = true;
    // Las fuentes web cargan después: recién ahí el ancho real de cada nombre es el definitivo.
    // (ready puede resolverse antes de que empiece a bajar la fuente del diseño: también se escucha loadingdone).
    const reigualar = () => { if (vivo && nombres) { igualarNombres(elementoCaja, nombres, ajustarNombres); medir(); } };
    document.fonts?.ready.then(reigualar);
    document.fonts?.addEventListener?.('loadingdone', reigualar);
    const observer = new ResizeObserver(medir);
    observer.observe(elementoCaja);
    observer.observe(contenedor);
    window.addEventListener('resize', medir);
    return () => {
      vivo = false;
      document.fonts?.removeEventListener?.('loadingdone', reigualar);
      observer.disconnect();
      window.removeEventListener('resize', medir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, nombres?.[0], nombres?.[1], ajustarNombres]);

  return caja;
}

// Ancho de referencia del lienzo que arma cada plantilla: las 25 usan
// SIEMPRE valores fijos en píxeles (56px los puntos, 40px el logo, etc. —
// nunca vw/vh), calibrados a mano para un canvas de OBS de 1920×1080 (el
// tamaño de Browser Source más común, y el que ya declaran los comentarios
// de PreviaCombinada). Nada en el layout real depende de este número salvo
// esta miniatura: la escena pública real (EscenaPublica.jsx) no tiene NINGÚN
// transform — ahí el navegador/OBS decide el tamaño real según el ancho que
// le hayan dado al Browser Source.
export const LIENZO_ANCHO_REFERENCIA = 1920;

// Convierte el ancho real (en px de pantalla) del recuadro chico de vista
// previa en el factor de escala exacto para que el lienzo de adentro (fijo a
// 1920×1080, ver miniPreview.css) quede mostrado a esa proporción — así una
// caja diseñada con `font-size: 56px` se ve, en la miniatura, exactamente al
// mismo % del ancho de pantalla que se vería en un Browser Source real de
// 1920px, sea cual sea el ancho en que el recuadro chico termine layouteado
// (el catálogo lo muestra angosto, "Personalizar tablero" lo muestra grande
// — antes ambos usaban el mismo 0.25 fijo sin importar su propio ancho, lo
// que en la práctica simulaba un canvas de un tamaño DISTINTO en cada lugar,
// ninguno de los cuales era 1920 real — de ahí que todo se viera más chico
// de lo que después se ve en OBS).
export function useEscalaLienzo(marcoRef) {
  const [escala, setEscala] = useState(0.25);

  useEffect(() => {
    const marco = marcoRef.current;
    if (!marco) return undefined;
    const medir = () => {
      const ancho = marco.getBoundingClientRect().width;
      if (ancho > 0) setEscala(ancho / LIENZO_ANCHO_REFERENCIA);
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(marco);
    return () => observer.disconnect();
  }, [marcoRef]);

  return escala;
}

