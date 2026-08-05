import { useRef } from 'react';
import { obtenerPlantilla } from './registro';
import VistaNomina from './vistas/VistaNomina';
import VistaEstadisticas from './vistas/VistaEstadisticas';
import VistaAnuncios from './vistas/VistaAnuncios';
import LogoMarcaAgua from './LogoMarcaAgua';
import LogoFlotante from './LogoFlotante';
import TituloMarcador from './TituloMarcador';
import LogosLibres from './LogosLibres';
import PopSumaPuntos from './PopSumaPuntos';
import { PARTIDO_DEMO, JUGADAS_DEMO } from './datosDemo';
import { useCajaMarcador, useMedidaElemento, useMedidaConjunto } from './utils';
import './miniPreview.css';

// Selector del contenido REAL a encuadrar en cada modo "un solo elemento" —
// nómina/estadísticas/anuncios no ocupan agrandado el lienzo entero por
// diseño (son bloques centrados con bastante aire alrededor), así que sin
// esto se verían chicos y perdidos en vez de "en grande, ajustado a la
// pantalla" como se pidió. El marcador usa su propio hook (useCajaMarcador,
// ya afinado en rondas anteriores) — acá solo van los otros tres.
const SELECTOR_CONTENIDO = { nomina: '.nomina-fila', estadisticas: '.stats-caja', anuncios: '.anuncios-toast' };

// Todos los selectores de contenido real que puede haber en el lienzo — se
// usa en modo 'general' para encuadrar TODO lo que esté activo de una, en
// vez de mostrar el lienzo 1920×1080 entero sin zoom (que dejaba todo
// diminuto en un mar vacío si el diseño no ocupa la pantalla completa).
const SELECTORES_TODO = ['.plantilla-marcador > :first-child', '.nomina-fila', '.stats-caja', '.anuncios-toast', '.logo-libre-img'];

// Opacidad de una capa que NO es la que se está editando ahora mismo — se
// deja ver (para poder alinear un diseño contra el otro) pero bien
// discreta, y sin sus controles de arrastre (esos ya vienen apagados solos:
// cada `xEditable` de más abajo solo se prende para la pestaña activa).
const OPACIDAD_CONTEXTO = 0.14;

// Todas las escenas activas se renderizan como hermanos dentro del mismo
// lienzo escalado: cada una es internamente position:fixed;inset:0, así que
// se apilan unas sobre otras y componen en un solo recuadro — igual que se
// verían juntas en una transmisión real, sin necesitar 4 recuadros sueltos.
// Es una vista previa de solo lectura: la posición/tamaño del marcador se
// ajustan con los campos en píxeles del formulario, no arrastrando acá.
//
// `equipoLocalPreview`/`equipoVisitaPreview` traen lo que se está tipeando/
// eligiendo AHORA MISMO en la ficha de cada equipo ({ nombre, color,
// logo_url }) — así la vista previa siempre refleja datos reales en vivo,
// no un selector de "equipo de muestra" aparte.
//
// `partidoReal` (opcional): si "Juego en vivo" ya tiene un partido
// preparado, Mesa lo reporta hacia arriba (ver onPartidoCambio en Mesa.jsx)
// y ACÁ se usa como base en vez de los datos de muestra — así se ve el
// marcador de verdad (puntaje, reloj, plantel) mientras se sigue ajustando
// el diseño. equipoLocalPreview/equipoVisitaPreview siguen pisando encima
// nombre/color/logo (lo que se está tipeando puede ir un paso adelante de
// lo que ya se guardó).
//
// `modo` decide qué capa queda RESALTADA (a tamaño real, editable, con
// zoom si corresponde) — pero las otras tres NO desaparecen: quedan
// dibujadas igual, bien tenues (OPACIDAD_CONTEXTO) y bloqueadas (sin sus
// controles de arrastre), para poder ver cómo queda un diseño respecto a
// los demás sin que compitan por la atención ni se puedan tocar por
// accidente. Es el mismo criterio que un editor de diseño gráfico con
// capas: una activa, el resto de fondo como referencia.
// - 'general': las 4 capas a la vista, TODAS a opacidad plena, con zoom
//   automático al conjunto de lo que esté activo (useMedidaConjunto) — así
//   se ve grande y compuesto en vez de perdido en el lienzo 1920×1080
//   entero. Es la foto completa del diseño, sin ninguna resaltada en
//   particular.
// - 'marcador': el marcador a opacidad plena (+ logo/título), con zoom
//   automático a la caja ya renderizada — nómina/estadísticas/anuncios
//   quedan de fondo, tenues, para chequear que no se pisen.
// - 'nomina' / 'estadisticas' / 'anuncios': esa capa a opacidad plena y
//   zoom a su propio contenido — sea cual sea su interruptor "Mostrar..."
//   (se está editando, tiene que verse) — el resto queda de fondo.
export default function PreviaCombinada({
  plantillaId, config, equipoLocalPreview, equipoVisitaPreview, partidoReal, modo = 'general',
  logosLibresEditable = false, onArrastrarLogoLibre,
  animacionPuntosEditable = false, onArrastrarAnimacionPuntos,
  anunciosEditable = false, onArrastrarAnuncios,
}) {
  const { Componente: Marcador } = obtenerPlantilla(plantillaId);
  // Mismo criterio que VistaMarcador (la escena pública real): el título y
  // los logos "a los costados" se anclan a la caja YA RENDERIZADA, medida de
  // verdad, no a una aproximación — así la vista previa se ve exactamente
  // como después se va a ver en OBS. Depende de `config` además de
  // `plantillaId` porque mover el tablero (posX/posY) no le cambia el
  // tamaño (el ResizeObserver de adentro del hook no dispara solo con eso).
  const lienzoRef = useRef(null);
  const caja = useCajaMarcador(lienzoRef, [plantillaId, config]);
  const medidaContenido = useMedidaElemento(lienzoRef, SELECTOR_CONTENIDO[modo], [modo, plantillaId, config]);
  // Solo hace falta calcularla en modo 'general' (las otras vistas ya
  // encuadran a su propio contenido puntual) — pasar un array vacío en el
  // resto evita un ResizeObserver de más sin ningún uso.
  const medidaConjunto = useMedidaConjunto(lienzoRef, modo === 'general' ? SELECTORES_TODO : [], [modo, plantillaId, config]);

  const base = partidoReal || PARTIDO_DEMO;
  const partido = (equipoLocalPreview || equipoVisitaPreview)
    ? {
        ...base,
        equipoLocal: equipoLocalPreview
          ? { ...base.equipoLocal, nombre: equipoLocalPreview.nombre, color: equipoLocalPreview.color, logo_url: equipoLocalPreview.logo_url || base.equipoLocal.logo_url }
          : base.equipoLocal,
        equipoVisita: equipoVisitaPreview
          ? { ...base.equipoVisita, nombre: equipoVisitaPreview.nombre, color: equipoVisitaPreview.color, logo_url: equipoVisitaPreview.logo_url || base.equipoVisita.logo_url }
          : base.equipoVisita,
      }
    : base;

  // Zoom al contenido real de lo que se está editando: en 'marcador' encuadra
  // la caja ya medida (useCajaMarcador); en 'nomina'/'estadisticas'/
  // 'anuncios' encuadra su propio bloque visible (useMedidaElemento, ver
  // SELECTOR_CONTENIDO) — mismo cálculo para los dos casos. Es un transform
  // ADICIONAL, aplicado en un wrapper AFUERA del lienzo (así no se toca el
  // scale(0.25) fijo de `.mini-preview-lienzo`, que sigue haciendo falta
  // para que las capas de pantalla completa midan bien). Los campos usados
  // (left/width relativos al ANCHO, topAlto/heightAlto relativos al ALTO) ya
  // vienen como % del lienzo renderizado = % del marco visible — alcanza con
  // centrar ese punto y agrandar hasta que el lado más chico ocupe el
  // `RELLENO`% del marco.
  const RELLENO = 74;
  // 'anuncios' encuadra la caja del MARCADOR (no el toast) a propósito: el
  // aviso siempre se ancla cerca de él, así que mostrar los dos juntos con
  // el marcador como referencia de tamaño es lo que deja ver de verdad si
  // el aviso quedó desproporcionado — encuadrar solo el toast (como antes)
  // dejaba al marcador afuera del encuadre, editando el tamaño "a ciegas".
  // Excepción: con posición LIBRE el aviso puede estar en cualquier punto
  // de la pantalla, lejos del marcador — ahí no conviene ningún zoom
  // ajustado, se ve el lienzo completo (igual que Logos libres) para poder
  // arrastrar la marca a cualquier lado sin que quede fuera del encuadre.
  const anunciosLibre = modo === 'anuncios' && (config?.alertaPosicion || '') === 'libre';
  const medidaAEncuadrar = anunciosLibre
    ? null
    : modo === 'general'
      ? medidaConjunto
      : (modo === 'marcador' || modo === 'anuncios')
        ? caja
        : medidaContenido;
  let estiloZoom;
  if (medidaAEncuadrar) {
    const zoomAncho = RELLENO / Math.max(1, medidaAEncuadrar.width);
    const zoomAlto = RELLENO / Math.max(1, medidaAEncuadrar.heightAlto);
    // El tope de zoom era 8x — de sobra mientras "Tamaño general" solo
    // llegaba hasta 50%. Ahora que baja hasta 5% (y estirar ancho/alto
    // también), una caja bien achicada podía necesitar bastante más de 8x
    // para llenar el `RELLENO`% del marco — se quedaba a mitad de camino,
    // chica en un lienzo enorme, aunque el zoom SÍ se estuviera aplicando.
    // El `Math.max(1, ...)` de arriba ya limita el caso extremo (una caja
    // de <1% de ancho no pide más de ~74x), así que subir el tope acá no
    // arriesga un zoom fuera de control.
    const zoom = Math.max(0.4, Math.min(60, Math.min(zoomAncho, zoomAlto)));
    const cx = medidaAEncuadrar.left + medidaAEncuadrar.width / 2;
    const cy = medidaAEncuadrar.topAlto + medidaAEncuadrar.heightAlto / 2;
    estiloZoom = { transform: `translate(${50 - zoom * cx}%, ${50 - zoom * cy}%) scale(${zoom})` };
  } else {
    estiloZoom = { transform: 'none' };
  }

  // El marcador es siempre la referencia de fondo — se dibuja en todos los
  // modos (a opacidad plena en 'general'/'marcador'/'anuncios', tenue en
  // 'nomina'/'estadisticas'). Nómina/Estadísticas/Anuncios, en cambio, solo
  // se dibujan si son la pestaña activa (tiene que verse SIEMPRE mientras
  // se edita, esté o no habilitada) o si están habilitadas para el diseño
  // (ahí aparecen como referencia tenue en las demás pestañas) — si están
  // apagadas del todo, no tiene sentido mostrarlas ni de fondo.
  const conNomina = modo === 'nomina' || Boolean(config?.mostrarNomina);
  const conEstadisticas = modo === 'estadisticas' || Boolean(config?.mostrarEstadisticas);
  const conAnuncios = modo === 'anuncios' || Boolean(config?.anunciarJugadas);
  // La animación de sumar puntos solo se dispara con un cambio de puntaje
  // real — sin esto la pestaña Marcador nunca la mostraba, así que se
  // ajustaba a ciegas. Se fuerza visible (2 y 3 puntos, uno por lado)
  // mientras se edita esa pestaña puntual, y como referencia tenue en las
  // demás si el diseño la tiene habilitada.
  const mostrarDemoPuntos = modo === 'marcador' || Boolean(config?.mostrarAnimacionPuntos);
  // Opacidad "capa activa vs. capa de fondo": en 'general' todo va a
  // opacidad plena (es la foto completa, sin ninguna resaltada); en
  // cualquier otro modo, solo la capa que coincide con la pestaña queda a
  // opacidad plena — el resto se ve bien tenue, de referencia, sin
  // competir por la atención ni poder tocarse (los `xEditable` de más
  // abajo ya vienen apagados solos para lo que no es la pestaña activa).
  const opacidadDe = (capa) => (modo === 'general' || modo === capa ? 1 : OPACIDAD_CONTEXTO);
  const opacidadMarcador = modo === 'anuncios' ? 1 : opacidadDe('marcador');
  const suprimirTitulo = (modo === 'general' || modo === 'anuncios') && conAnuncios && config?.anunciosTituloModo === 'reemplaza-titulo';

  return (
    <div className="mini-preview-marco mini-preview-grande">
      <div className="mini-preview-zoom" style={estiloZoom}>
        <div className="mini-preview-lienzo" ref={lienzoRef}>
          <div style={{ opacity: opacidadMarcador, transition: 'opacity .25s ease', pointerEvents: opacidadMarcador === 1 ? 'auto' : 'none' }}>
            <LogoMarcaAgua equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} config={config} caja={caja} />
            <Marcador partido={partido} config={config} />
            <LogoFlotante equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} config={config} plantillaId={plantillaId} caja={caja} />
            <TituloMarcador config={config} plantillaId={plantillaId} caja={caja} suprimir={suprimirTitulo} />
            {mostrarDemoPuntos && (
              <PopSumaPuntos
                partido={partido}
                config={config}
                demo
                editable={animacionPuntosEditable}
                onArrastrar={onArrastrarAnimacionPuntos}
                contenedorRef={lienzoRef}
                caja={caja}
              />
            )}
          </div>
          {conNomina && (
            <div style={{ opacity: opacidadDe('nomina'), transition: 'opacity .25s ease', pointerEvents: opacidadDe('nomina') === 1 ? 'auto' : 'none' }}>
              <VistaNomina partido={partido} modo="ambos" config={config} plantillaId={plantillaId} />
            </div>
          )}
          {conEstadisticas && (
            <div style={{ opacity: opacidadDe('estadisticas'), transition: 'opacity .25s ease', pointerEvents: opacidadDe('estadisticas') === 1 ? 'auto' : 'none' }}>
              <VistaEstadisticas partido={partido} config={{ modo: 'equipo', equipo: 'local' }} tema={config} plantillaId={plantillaId} />
            </div>
          )}
          {conAnuncios && (
            <div style={{ opacity: opacidadDe('anuncios'), transition: 'opacity .25s ease', pointerEvents: opacidadDe('anuncios') === 1 ? 'auto' : 'none' }}>
              <VistaAnuncios
                jugadas={JUGADAS_DEMO}
                config={config}
                tema={config}
                plantillaId={plantillaId}
                colorLocal={partido.equipoLocal.color}
                colorVisita={partido.equipoVisita.color}
                caja={caja}
                demo
                editable={anunciosEditable}
                onArrastrar={onArrastrarAnuncios}
                contenedorRef={lienzoRef}
              />
            </div>
          )}
          <LogosLibres config={config} editable={logosLibresEditable} onArrastrar={onArrastrarLogoLibre} contenedorRef={lienzoRef} />
        </div>
      </div>
    </div>
  );
}
