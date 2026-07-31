import { useEffect, useState } from 'react';
import { estiloTema, estiloAnclaAlerta, familiaDePlantilla, fuenteDePlantilla, FAMILIAS_VISUALES } from '../utils';
import '../anuncios.css';

export default function VistaAnuncios({ jugadas, config, tema, plantillaId, demo = false, colorLocal, colorVisita }) {
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
  const claseFamilia = `fam-${familiaAnimacion} modo-${modoAlerta} lado-${ladoTab}`;
  const estiloAncla = {
    ...estiloTema(tema),
    '--pm-fuente': fuenteDePlantilla(plantillaId),
    ...(colorEquipo ? { '--anuncio-color-equipo': colorEquipo } : {}),
    ...estiloAnclaAlerta(tema, modoAlerta, ladoTab),
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
