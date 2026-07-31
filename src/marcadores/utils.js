import { useEffect, useRef, useState } from 'react';

export const formatearReloj = (totalSegundos = 0) => {
  const segurosTotal = Math.max(0, Number(totalSegundos) || 0);
  const minutos = Math.floor(segurosTotal / 60);
  const segundos = segurosTotal % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
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
  clasico: 'clasico', ncaa: 'clasico', 'championship-gold': 'clasico', 'euro-divider': 'clasico',
  nba: 'broadcast', ticker: 'broadcast', 'espn-ticker': 'broadcast', 'lower-third': 'broadcast', 'broadcast-bonus': 'broadcast',
  neon: 'neon', 'arena-glow': 'neon', 'retro-led': 'neon', 'gradient-wave': 'neon',
  street: 'streetball', split: 'streetball', 'slant-dynamic': 'streetball', 'outline-bold': 'streetball', 'compacto-tofo': 'streetball', 'record-block': 'streetball',
  minimal: 'cristal', 'corner-min': 'cristal', glass: 'cristal', 'card-stack': 'cristal', 'circle-focus': 'cristal', 'pildora-doble': 'cristal',
};

export const familiaDePlantilla = (plantillaId) => FAMILIA_POR_PLANTILLA[plantillaId] || 'clasico';

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
};

export const fuenteDePlantilla = (plantillaId) => FUENTE_POR_PLANTILLA[plantillaId] || "'Oswald', sans-serif";

// Catálogo de tipografías elegibles a mano (config.fuenteMarcador) — son
// las mismas 13 familias de Google Fonts que ya carga plantillas.css para
// las 25 plantillas (más 'Courier New' y 'system-ui', del sistema), así
// que elegir cualquiera de acá no suma ni un solo pedido de red nuevo: ya
// están cargadas siempre, se usen o no en la plantilla activa.
export const FUENTES_DISPONIBLES = [
  { id: '', etiqueta: 'Automática (la de la plantilla)' },
  { id: "'Orbitron', sans-serif", etiqueta: 'Orbitron — digital, angulosa' },
  { id: "'Oswald', sans-serif", etiqueta: 'Oswald — condensada, prolija' },
  { id: "'Bebas Neue', sans-serif", etiqueta: 'Bebas Neue — grande, impactante' },
  { id: "'Anton', sans-serif", etiqueta: 'Anton — extra gruesa' },
  { id: "'Bungee', sans-serif", etiqueta: 'Bungee — street, con relieve' },
  { id: "'Barlow Condensed', sans-serif", etiqueta: 'Barlow Condensed — angosta, moderna' },
  { id: "'Rajdhani', sans-serif", etiqueta: 'Rajdhani — técnica, futurista' },
  { id: "'Russo One', sans-serif", etiqueta: 'Russo One — sólida, arcade' },
  { id: "'Teko', sans-serif", etiqueta: 'Teko — muy angosta, alta' },
  { id: "'Poppins', sans-serif", etiqueta: 'Poppins — redondeada, amable' },
  { id: "'Cinzel', serif", etiqueta: 'Cinzel — clásica, con serifa' },
  { id: "'Titillium Web', sans-serif", etiqueta: 'Titillium Web — limpia, corporativa' },
  { id: "'Exo 2', sans-serif", etiqueta: 'Exo 2 — geométrica, sci-fi' },
  { id: "'Courier New', monospace", etiqueta: 'Courier New — máquina de escribir' },
  { id: 'system-ui, sans-serif', etiqueta: 'Del sistema — minimalista' },
];

// Fuente efectiva de un diseño: la elegida a mano en Personalizar diseño
// (config.fuenteMarcador) si hay una, o si no la propia de la plantilla
// (fuenteDePlantilla) — así "Automática" (el valor por defecto, cadena
// vacía) preserva el look de autor de cada plantilla tal cual estaba.
export const fuenteEfectiva = (config, plantillaId) => config?.fuenteMarcador || fuenteDePlantilla(plantillaId);

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
export function estiloAnclaAlerta(tema = {}, modo = 'arriba', lado = 'izquierda') {
  const posX = Number.isFinite(tema?.posX) ? tema.posX : 50;
  const posY = Number.isFinite(tema?.posY) ? tema.posY : 88;
  const mitad = mitadCajaProporcional(tema);

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

  // 'arriba': pegada al borde superior de la caja, centrada.
  return {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: `${posX}%`,
    paddingTop: paddingTopDesdeY(Math.max(0, posY - mitad.y)),
  };
}

// Ancla el logo flotante (modo 'arriba'/'abajo') cerca de la caja del
// marcador, igual que estiloAnclaAlerta — reusa la misma corrección de
// aspect-ratio para que "arriba"/"abajo" apunten donde realmente se ve, y la
// misma mitad proporcional para que la cercanía no se rompa al agrandar.
export function estiloAnclaLogo(tema = {}, modo = 'arriba') {
  const posX = Number.isFinite(tema?.posX) ? tema.posX : 50;
  const posY = Number.isFinite(tema?.posY) ? tema.posY : 88;
  const mitad = mitadCajaProporcional(tema);
  const y = modo === 'abajo' ? Math.min(100, posY + mitad.y + 2) : Math.max(0, posY - mitad.y - 16);
  return {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: `${Math.max(0, Math.min(96, posX - mitad.x * 0.5))}%`,
    paddingTop: paddingTopDesdeY(y),
  };
}

// Ancla el logo "dentro de la caja" (config.logoCajaModo === 'dentro') justo
// en el borde superior/inferior del marcador, sin ningún hueco — mismo
// criterio de "pegado + transform fijo en CSS" que estiloAnclaAlerta/Titulo,
// para que el marcador se vea "más alto" en vez de tener un logo flotando
// aparte. Distinta de estiloAnclaLogo (el modo 'fuera', que sí deja hueco).
export function estiloAnclaLogoCaja(tema = {}, modo = 'arriba') {
  const posX = Number.isFinite(tema?.posX) ? tema.posX : 50;
  const posY = Number.isFinite(tema?.posY) ? tema.posY : 88;
  const mitad = mitadCajaProporcional(tema);
  const y = modo === 'abajo' ? Math.min(100, posY + mitad.y) : Math.max(0, posY - mitad.y);
  return {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: `${posX}%`,
    paddingTop: paddingTopDesdeY(y),
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
export function estiloAnclaPop(tema = {}, lado, posicion = 'costado') {
  const posX = Number.isFinite(tema?.posX) ? tema.posX : 50;
  const posY = Number.isFinite(tema?.posY) ? tema.posY : 88;
  const mitad = mitadCajaProporcional(tema);

  if (posicion === 'centro') {
    return { justifyContent: 'center', alignItems: 'center', paddingLeft: 0, paddingTop: 0 };
  }

  if (posicion === 'arriba') {
    const arribaY = paddingTopDesdeY(Math.max(0, posY - mitad.y - 16));
    if (lado === 'visita') {
      const x = Math.min(94, posX + 6);
      return { justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: `${x}%`, paddingTop: arribaY };
    }
    const x = Math.max(6, posX - 6);
    return { justifyContent: 'flex-end', alignItems: 'flex-start', paddingRight: `${100 - x}%`, paddingTop: arribaY };
  }

  // 'costado': separación idéntica de los dos lados respecto al borde real
  // de la caja, y cada uno crece "hacia afuera" (nunca hacia el marcador).
  const separacion = mitad.x + 3;
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

// Cómo se leen las faltas en el tablero: número (comportamiento de siempre),
// puntos o líneas tipo tarja — capado para no desbordar la caja si el
// partido acumula muchas faltas (el número real sigue contando aparte, acá
// solo cambia cómo se dibuja).
const TOPE_INDICADOR_FALTAS = 8;
export function indicadorFaltas(cantidad, estilo) {
  const n = Math.max(0, Number(cantidad) || 0);
  if (estilo === 'puntos' || estilo === 'lineas') {
    const simbolo = estilo === 'puntos' ? '●' : '|';
    const visibles = Math.min(n, TOPE_INDICADOR_FALTAS);
    const extra = n > TOPE_INDICADOR_FALTAS ? `+${n - TOPE_INDICADOR_FALTAS}` : '';
    return `${simbolo.repeat(visibles)}${extra}`;
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
export function useCajaMarcador(contenedorRef, dependencias = []) {
  const [caja, setCaja] = useState(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return undefined;
    const wrapper = contenedor.querySelector('.plantilla-marcador');
    const elementoCaja = wrapper?.firstElementChild;
    if (!elementoCaja) return undefined;

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
      });
    };

    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(elementoCaja);
    observer.observe(contenedor);
    window.addEventListener('resize', medir);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', medir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  return caja;
}

// Versión genérica de useCajaMarcador para cualquier selector, no solo la
// caja del marcador — la usa la vista previa (PreviaCombinada) para
// encuadrar/hacer zoom a la nómina, las estadísticas o el aviso de
// anuncios, cada uno con su propio contenido real ya renderizado (mismo
// principio: medir de verdad, no aproximar).
//
// Suma un remedido extra a los ~450ms: la nómina y el aviso de anuncios
// entran con una animación (deslizan/aparecen) — si el primer `medir()`
// cae a mitad de esa animación, la caja de zoom queda calculada sobre un
// tamaño/posición todavía en movimiento. El ResizeObserver no lo corrige
// solo porque una animación de transform/opacity no cambia el tamaño del
// elemento, así que hace falta este remedido de una sola vez.
export function useMedidaElemento(contenedorRef, selector, dependencias = []) {
  const [medida, setMedida] = useState(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || !selector) { setMedida(null); return undefined; }
    const elemento = contenedor.querySelector(selector);
    if (!elemento) { setMedida(null); return undefined; }

    const medir = () => {
      const rectEl = elemento.getBoundingClientRect();
      const rectContenedor = contenedor.getBoundingClientRect();
      if (rectContenedor.width === 0 || rectEl.width === 0 || rectContenedor.height === 0) return;
      setMedida({
        top: ((rectEl.top - rectContenedor.top) / rectContenedor.width) * 100,
        left: ((rectEl.left - rectContenedor.left) / rectContenedor.width) * 100,
        width: (rectEl.width / rectContenedor.width) * 100,
        height: (rectEl.height / rectContenedor.width) * 100,
        topAlto: ((rectEl.top - rectContenedor.top) / rectContenedor.height) * 100,
        heightAlto: (rectEl.height / rectContenedor.height) * 100,
      });
    };

    medir();
    const remedido = setTimeout(medir, 450);
    const observer = new ResizeObserver(medir);
    observer.observe(elemento);
    observer.observe(contenedor);
    window.addEventListener('resize', medir);
    return () => {
      clearTimeout(remedido);
      observer.disconnect();
      window.removeEventListener('resize', medir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, ...dependencias]);

  return medida;
}
