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
import { useCajaMarcador, useEscalaLienzo } from './utils';
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
// `modo` decide qué capa queda RESALTADA (a opacidad plena, editable).
// Nómina y Estadísticas son disparos momentáneos en la transmisión real
// (ver el comentario de `conNomina`/`conEstadisticas` más abajo) — por eso
// NO quedan como referencia tenue de fondo en otras pestañas, para que la
// vista de 'marcador' (la que se ve la mayor parte del partido) se parezca
// de verdad a como se ve en vivo: el marcador solo, sin nada más encima.
// Anuncios sí es una capa permanente real (anima sola cada jugada) y queda
// de fondo tenue igual que antes. Es el mismo criterio que un editor de
// diseño gráfico con capas: una activa, el resto de fondo como referencia
// — pero solo para las capas que de verdad conviven siempre en pantalla.
// - 'general': las 4 capas a la vista, TODAS a opacidad plena — una foto
//   compuesta del diseño completo, útil para revisar que todo combine,
//   aunque nómina/estadísticas nunca se vean así de verdad al mismo tiempo
//   que el marcador en la transmisión.
// - 'marcador': el marcador a opacidad plena (+ logo/título) — igual que
//   se ve casi todo el partido en la transmisión real. Anuncios queda de
//   fondo, tenue, si está habilitado; nómina/estadísticas no se dibujan.
// - 'nomina' / 'estadisticas': esa capa sola, a opacidad plena — sea cual
//   sea su interruptor "Mostrar..." (se está editando, tiene que verse) —
//   el marcador queda de fondo, tenue, como referencia de alineación.
// - 'anuncios': el anuncio a opacidad plena, marcador de fondo tenue.
export default function PreviaCombinada({
  plantillaId, config, equipoLocalPreview, equipoVisitaPreview, partidoReal, modo = 'general',
  logosLibresEditable = false, onArrastrarLogoLibre,
  animacionPuntosEditable = false, onArrastrarAnimacionPuntos,
  anunciosEditable = false, onArrastrarAnuncios,
  // Modo "pantalla completa": el recuadro 16:9 de siempre (mismo mecanismo,
  // ver el comentario de arriba — nunca hace zoom ni recorta) pero usando
  // TODO el viewport disponible en vez del ancho acotado del panel de
  // edición. Es lo más cerca que se puede llegar, dentro del navegador, de
  // "verlo como se ve de verdad" — un recuadro de 1600px en una notebook
  // angosta todavía queda bastante por debajo del 100% real; a pantalla
  // completa, en la mayoría de las pantallas, la escala se acerca mucho más
  // a 1:1.
  pantallaCompleta = false,
  onCerrarPantallaCompleta,
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
  // El marco (recuadro visible) puede terminar en cualquier ancho según el
  // layout de la pantalla — la escala real del lienzo (1920×1080 fijo) se
  // recalcula a partir de ESE ancho, no de un porcentaje fijo, para que lo
  // que se vea acá sea proporcionalmente idéntico a un Browser Source real
  // (ver useEscalaLienzo en utils.js — antes un 0.25 constante simulaba un
  // canvas de un ancho distinto según cuán grande estuviera este recuadro).
  const marcoRef = useRef(null);
  const escalaLienzo = useEscalaLienzo(marcoRef);

  const base = partidoReal || PARTIDO_DEMO;
  const partido = (equipoLocalPreview || equipoVisitaPreview)
    ? {
        ...base,
        equipoLocal: equipoLocalPreview
          ? { ...base.equipoLocal, nombre: equipoLocalPreview.nombre, color: equipoLocalPreview.color, logo_url: equipoLocalPreview.logo_url || base.equipoLocal.logo_url, codigo: equipoLocalPreview.codigo || null }
          : base.equipoLocal,
        equipoVisita: equipoVisitaPreview
          ? { ...base.equipoVisita, nombre: equipoVisitaPreview.nombre, color: equipoVisitaPreview.color, logo_url: equipoVisitaPreview.logo_url || base.equipoVisita.logo_url, codigo: equipoVisitaPreview.codigo || null }
          : base.equipoVisita,
      }
    : base;

  // El marcador es siempre la referencia de fondo — se dibuja en todos los
  // modos. Nómina y Estadísticas, en la transmisión real, NO quedan nunca
  // permanentes: EscenaPublica.jsx solo las dibuja mientras dura el pulso
  // disparado a mano desde la Mesa (`cfg.mostrarNomina && nomina`, unos
  // pocos segundos) — el resto del partido son invisibles, aunque el
  // diseño las tenga habilitadas. Antes acá se dibujaban SIEMPRE que
  // `config.mostrarNomina/mostrarEstadisticas` estuviera prendido (aunque
  // fuera tenues, de fondo) — eso hacía que la vista previa se viera todo
  // el tiempo más cargada/chica de lo que realmente se ve en la
  // transmisión, que la mayor parte del partido es solo el marcador solo.
  // Ahora solo se dibujan cuando son la pestaña que se está editando (tiene
  // que verse SIEMPRE ahí, se use o no) o en 'general' ("Ver todo junto"),
  // que es la única vista pensada como composición de las 4 capas a la vez
  // a propósito, no como "cómo se ve ahora". Anuncios es distinto: en la
  // transmisión real SÍ queda montado todo el partido (anima cada jugada
  // sola, ver VistaAnuncios) mientras el diseño la tenga habilitada, así
  // que ahí sí se mantiene el criterio anterior.
  const conNomina = modo === 'nomina' || modo === 'general';
  const conEstadisticas = modo === 'estadisticas' || modo === 'general';
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
    <>
      {pantallaCompleta && <div className="mini-preview-fondo" onClick={onCerrarPantallaCompleta} />}
      <div className={`mini-preview-marco mini-preview-grande ${pantallaCompleta ? 'mini-preview-pantalla-completa' : ''}`} ref={marcoRef}>
        {pantallaCompleta && (
          <button type="button" className="mini-preview-cerrar" onClick={onCerrarPantallaCompleta} title="Salir de pantalla completa">✕</button>
        )}
        <div className="mini-preview-lienzo" ref={lienzoRef} style={{ '--escala-lienzo': escalaLienzo }}>
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
    </>
  );
}
