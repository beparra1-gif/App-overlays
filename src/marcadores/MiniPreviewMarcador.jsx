import { useRef } from 'react';
import { obtenerPlantilla } from './registro';
import { PARTIDO_DEMO } from './datosDemo';
import { useEscalaLienzo } from './utils';
import LogosLibres from './LogosLibres';
import ElementosLibres from './ElementosLibres';
import './miniPreview.css';

// La miniatura de catálogo (tarjetas de "Diseños") — a diferencia de
// PreviaCombinada (el panel grande de edición), acá no hace falta nómina/
// estadísticas/anuncios ni nada editable: es una FOTO fija de cómo se ve
// el marcador solo. Pero SÍ hace falta dibujar LogosLibres/ElementosLibres
// (de solo lectura, sin `editable`) — si no, cualquier plantilla armada en
// el Creador (que vive ENTERA en config.creadorElementos, ya que "Creador
// Libre" es un lienzo en blanco) se ve como una tarjeta vacía en el
// catálogo, aunque el diseño de verdad tenga contenido. Antes de este
// cambio pasaba exactamente eso — la miniatura de una plantilla propia no
// mostraba nada de lo diseñado.
export default function MiniPreviewMarcador({ plantillaId, config }) {
  const { Componente } = obtenerPlantilla(plantillaId);
  // Mismo cálculo que PreviaCombinada: la miniatura de catálogo es angosta
  // (una tarjeta chica), pero tiene que mostrar la plantilla a la misma
  // proporción relativa que un Browser Source real de 1920×1080 — no un
  // 0.25 fijo pensado para otro ancho.
  const marcoRef = useRef(null);
  const lienzoRef = useRef(null);
  const escalaLienzo = useEscalaLienzo(marcoRef);
  return (
    <div className="mini-preview-marco" ref={marcoRef}>
      <div className="mini-preview-lienzo" ref={lienzoRef} style={{ '--escala-lienzo': escalaLienzo }}>
        <Componente partido={PARTIDO_DEMO} config={config} />
        <LogosLibres config={config} contenedorRef={lienzoRef} />
        <ElementosLibres partido={PARTIDO_DEMO} config={config} contenedorRef={lienzoRef} escalaLienzo={escalaLienzo} />
      </div>
    </div>
  );
}
