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
import { useCajaMarcador } from './utils';
import './miniPreview.css';

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
// El recuadro 16:9 SIEMPRE muestra el lienzo 1920×1080 completo, a la
// MISMA escala, sin ningún zoom automático — ni acercando al elemento que
// se está editando, ni encuadrando "lo que esté activo". Esto NO es una
// simplificación de menos esfuerzo: es a propósito. Un zoom automático que
// cambia según qué pestaña está abierta (o según dónde arrastres algo)
// rompe la única garantía que importa acá — que lo que se ve en esta
// vista previa sea EXACTAMENTE lo que después se ve en OBS, al mismo
// tamaño relativo, siempre. Con el lienzo siempre completo y a escala fija,
// mover/arrastrar un elemento acá se ve tal cual se va a ver en la
// transmisión — no hay sorpresas al pegar el enlace en OBS. (Antes esta
// vista sí hacía zoom por pestaña — se sacó a pedido: la pantalla "se iba
// agrandando" según la posición, en vez de quedarse fija con el 16:9 real
// adentro.)
//
// `modo` decide qué capa queda RESALTADA (a opacidad plena, editable) —
// las otras tres NO desaparecen: quedan dibujadas igual, bien tenues
// (OPACIDAD_CONTEXTO) y bloqueadas (sin sus controles de arrastre), para
// poder ver cómo queda un diseño respecto a los demás sin que compitan por
// la atención ni se puedan tocar por accidente. Es el mismo criterio que
// un editor de diseño gráfico con capas: una activa, el resto de fondo
// como referencia.
// - 'general': las 4 capas a la vista, TODAS a opacidad plena — la foto
//   completa del diseño, sin ninguna resaltada en particular.
// - 'marcador': el marcador a opacidad plena (+ logo/título) — nómina/
//   estadísticas/anuncios quedan de fondo, tenues.
// - 'nomina' / 'estadisticas' / 'anuncios': esa capa a opacidad plena —
//   sea cual sea su interruptor "Mostrar..." (se está editando, tiene que
//   verse) — el resto queda de fondo.
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
  // Esto NO tiene nada que ver con el zoom de la vista previa (no hay
  // ninguno): esta medida la usan LogoFlotante/TituloMarcador/VistaAnuncios
  // para anclarse al borde real de la caja del marcador.
  const lienzoRef = useRef(null);
  const caja = useCajaMarcador(lienzoRef, [plantillaId, config]);

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
  );
}
