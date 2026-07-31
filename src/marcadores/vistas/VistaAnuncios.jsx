import { useEffect, useState } from 'react';
import { estiloTema, estiloAnclaAlerta, familiaDePlantilla, fuenteEfectiva, FAMILIAS_VISUALES } from '../utils';
import '../anuncios.css';

// `caja` (ver useCajaMarcador): cuando el título del marcador está activo Y
// el aviso resuelve en modo "arriba" (pegado arriba de la caja, el mismo
// lugar donde vive el título), sin esto los dos terminaban superpuestos —
// con la medida real de la caja se puede apilar el aviso arriba del
// título, ponerlo en su mismo lugar (si el título se suprime, ver
// `config.anunciosTituloModo`), o mandarlo abajo del marcador en cambio.
export default function VistaAnuncios({ jugadas, config, tema, plantillaId, demo = false, colorLocal, colorVisita, caja }) {
  const anunciarFaltas = config?.anunciarFaltas !== false;
  const visibles = anunciarFaltas ? jugadas : (jugadas || []).filter((j) => j.tipo !== 'FALTA');
  const ultima = visibles?.[0];
  // Cuánto dura cada aviso en pantalla lo elige el diseño (Personalizar
  // diseño → Anuncios → segundos visible), con un respaldo si todavía no se
  // configuró — antes era un fijo de 3.8s para todos los diseños.
  const duracionVisibleMs = (Number(tema?.anunciosDuracionSeg) || 3.8) * 1000;

  // El desvanecido de salida lo maneja el propio componente (no una demora
  // fija en CSS): en la escena real, cada jugada nueva reinicia el timer;
  // en la vista previa estática (`demo`) nunca se programa, así que el
  // cartel de ejemplo queda visible en vez de desaparecer a los ~4s y no
  // volver nunca (eso es lo que pasaba antes: la animación con `forwards`
  // terminaba en opacity:0 y ahí se quedaba para siempre).
  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    setSaliendo(false);
    if (demo || !ultima) return undefined;
    const temporizador = setTimeout(() => setSaliendo(true), duracionVisibleMs);
    return () => clearTimeout(temporizador);
  }, [ultima?.ts, demo, duracionVisibleMs]);

  // El "look"/animación del cartel se puede fijar a mano (config.alertaAnimacion,
  // reusando directamente una de las 5 familias visuales como estilo elegible)
  // — si no se eligió ninguna, se usa la de la plantilla del marcador. La
  // posición sigue su propia lógica aparte (alertaPosicion / familia real).
  const familiaPlantilla = familiaDePlantilla(plantillaId);
  const familiaAnimacion = tema?.alertaAnimacion || familiaPlantilla;
  const modoAlerta = tema?.alertaPosicion || FAMILIAS_VISUALES[familiaPlantilla]?.modoAlerta || 'arriba';
  // El costado lo decide el EQUIPO que hizo la última jugada (local →
  // izquierda, visita → derecha), no dónde esté el marcador en la pantalla
  // — así la pestaña siempre "sale" del lado del equipo correspondiente.
  const ladoTab = ultima?.equipo === 'visita' ? 'derecha' : 'izquierda';
  const colorEquipo = ultima?.equipo === 'visita' ? colorVisita : colorLocal;

  // Con el título activo, "arriba" (el lugar de siempre) es exactamente
  // donde vive el título — sin este ajuste quedaban uno sobre el otro. Con
  // la caja real medida se resuelve según lo que se eligió en
  // Personalizar diseño → Anuncios; sin ella (o si el modo no es "arriba",
  // o no hay título) se sigue anclando como siempre (estiloAnclaAlerta).
  const tituloActivo = Boolean(tema?.mostrarTitulo && (tema?.tituloTexto || '').trim());
  const conTitulo = modoAlerta === 'arriba' && tituloActivo && caja;
  const modoTituloAnuncio = tema?.anunciosTituloModo || 'arriba-titulo';

  let claseModo = `modo-${modoAlerta}`;
  let claseModoExtra = '';
  let estiloPosicion;
  if (conTitulo) {
    const anclaX = caja.left + caja.width / 2;
    if (modoTituloAnuncio === 'debajo-marcador') {
      claseModo = 'modo-abajo-caja';
      estiloPosicion = { justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: `${anclaX}%`, paddingTop: `${caja.top + caja.height}%` };
    } else if (modoTituloAnuncio === 'reemplaza-titulo') {
      // El título se suprime desde afuera (ver suprimirTitulo en
      // VistaMarcador) — este aviso ocupa exactamente su mismo lugar.
      estiloPosicion = { justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: `${anclaX}%`, paddingTop: `${caja.top}%` };
    } else {
      // 'arriba-titulo' (por defecto): apilado ENCIMA del título — no se
      // conoce el alto exacto del banner del título, así que se deja un
      // margen generoso (5% del ancho del lienzo) para que no lo toque.
      claseModoExtra = 'anuncios-compacto';
      estiloPosicion = { justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: `${anclaX}%`, paddingTop: `${Math.max(0, caja.top - 5)}%` };
    }
  } else {
    estiloPosicion = estiloAnclaAlerta(tema, modoAlerta, ladoTab);
  }

  const claseFamilia = `fam-${familiaAnimacion} ${claseModo} lado-${ladoTab} ${claseModoExtra}`.trim();
  const estiloAncla = {
    ...estiloTema(tema),
    '--pm-fuente': fuenteEfectiva(tema, plantillaId),
    ...(colorEquipo ? { '--anuncio-color-equipo': colorEquipo } : {}),
    ...estiloPosicion,
  };

  if (!ultima) return <div className={`anuncios-overlay ${claseFamilia}`} style={estiloAncla} />;

  return (
    <div className={`anuncios-overlay ${claseFamilia}`} style={estiloAncla}>
      <div className="anuncios-ancla">
        <div className={`anuncios-toast ${saliendo ? 'anuncios-saliendo' : ''}`} key={ultima.ts}>{ultima.texto}</div>
      </div>
    </div>
  );
}
