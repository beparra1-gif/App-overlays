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
import { useCajaMarcador, useMedidaElemento } from './utils';
import './miniPreview.css';

// Selector del contenido REAL a encuadrar en cada modo "un solo elemento" —
// nómina/estadísticas/anuncios no ocupan agrandado el lienzo entero por
// diseño (son bloques centrados con bastante aire alrededor), así que sin
// esto se verían chicos y perdidos en vez de "en grande, ajustado a la
// pantalla" como se pidió. El marcador usa su propio hook (useCajaMarcador,
// ya afinado en rondas anteriores) — acá solo van los otros tres.
const SELECTOR_CONTENIDO = { nomina: '.nomina-fila', estadisticas: '.stats-caja', anuncios: '.anuncios-toast' };

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
// `modo` decide QUÉ se ve en el lienzo — pensado para que la vista previa
// siga a la pestaña que se está editando en vez de mostrar siempre las 4
// capas superpuestas (así no hay que "leer" al marcador chiquito escondido
// atrás de la nómina para saber si un cambio de color surtió efecto):
// - 'general': las 4 capas juntas, tal cual se verían en la transmisión
//   real (comportamiento de siempre).
// - 'marcador': SOLO el marcador (+ logo/título), con zoom automático a la
//   caja ya renderizada — así se ve grande incluso si está achicado o en una
//   esquina, en vez del marcador diminuto perdido en un lienzo 1920×1080.
// - 'nomina' / 'estadisticas' / 'anuncios': SOLO esa capa, siempre visible
//   (sin importar si su interruptor "Mostrar..." está apagado — se está
//   editando esa sección, tiene que verse mientras se ajusta) a tamaño
//   normal, porque esas ya ocupan toda la pantalla por diseño.
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
  const medidaAEncuadrar = anunciosLibre ? null : (modo === 'marcador' || modo === 'anuncios') ? caja : medidaContenido;
  let estiloZoom;
  if (medidaAEncuadrar) {
    const zoomAncho = RELLENO / Math.max(1, medidaAEncuadrar.width);
    const zoomAlto = RELLENO / Math.max(1, medidaAEncuadrar.heightAlto);
    const zoom = Math.max(0.4, Math.min(8, Math.min(zoomAncho, zoomAlto)));
    const cx = medidaAEncuadrar.left + medidaAEncuadrar.width / 2;
    const cy = medidaAEncuadrar.topAlto + medidaAEncuadrar.heightAlto / 2;
    estiloZoom = { transform: `translate(${50 - zoom * cx}%, ${50 - zoom * cy}%) scale(${zoom})` };
  } else {
    estiloZoom = { transform: 'none' };
  }

  // 'anuncios' ahora también dibuja el marcador (ver medidaAEncuadrar más
  // arriba) — para que se pueda comparar el tamaño del aviso contra el
  // marcador de verdad, en vez de verlo solo, flotando en un lienzo vacío.
  const conMarcador = modo === 'general' || modo === 'marcador' || modo === 'anuncios';
  const conNomina = modo === 'general' ? config?.mostrarNomina : modo === 'nomina';
  const conEstadisticas = modo === 'general' ? config?.mostrarEstadisticas : modo === 'estadisticas';
  const conAnuncios = modo === 'general' ? config?.anunciarJugadas : modo === 'anuncios';
  // La animación de sumar puntos no tiene pestaña propia (vive adentro de
  // Marcador) y solo se dispara con un cambio de puntaje real — sin esto la
  // vista previa nunca la mostraba, así que se ajustaba a ciegas. Se fuerza
  // visible (2 y 3 puntos, uno por lado) mientras se está viendo el
  // marcador, para poder ajustar tamaño/posición/ícono/animación en vivo.
  const mostrarDemoPuntos = modo === 'general' || modo === 'marcador';
  // En la vista previa el aviso demo está siempre visible (no se apaga
  // solo), así que en modo 'general' con "reemplaza el título" elegido, el
  // título se ve siempre suprimido — igual que se vería en la transmisión
  // real mientras un aviso está en pantalla.
  const suprimirTitulo = conMarcador && conAnuncios && config?.anunciosTituloModo === 'reemplaza-titulo';

  return (
    <div className="mini-preview-marco mini-preview-grande">
      <div className="mini-preview-zoom" style={estiloZoom}>
        <div className="mini-preview-lienzo" ref={lienzoRef}>
          {conMarcador && (
            <>
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
            </>
          )}
          {conNomina && <VistaNomina partido={partido} modo="ambos" config={config} plantillaId={plantillaId} />}
          {conEstadisticas && (
            <VistaEstadisticas partido={partido} config={{ modo: 'equipo', equipo: 'local' }} tema={config} plantillaId={plantillaId} />
          )}
          {conAnuncios && (
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
          )}
          <LogosLibres config={config} editable={logosLibresEditable} onArrastrar={onArrastrarLogoLibre} contenedorRef={lienzoRef} />
        </div>
      </div>
    </div>
  );
}
