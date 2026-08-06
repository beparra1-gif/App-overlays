import { useRef } from 'react';
import { obtenerPlantilla } from './registro';
import { PARTIDO_DEMO } from './datosDemo';
import { useEscalaLienzo } from './utils';
import './miniPreview.css';

export default function MiniPreviewMarcador({ plantillaId, config }) {
  const { Componente } = obtenerPlantilla(plantillaId);
  // Mismo cálculo que PreviaCombinada: la miniatura de catálogo es angosta
  // (una tarjeta chica), pero tiene que mostrar la plantilla a la misma
  // proporción relativa que un Browser Source real de 1920×1080 — no un
  // 0.25 fijo pensado para otro ancho.
  const marcoRef = useRef(null);
  const escalaLienzo = useEscalaLienzo(marcoRef);
  return (
    <div className="mini-preview-marco" ref={marcoRef}>
      <div className="mini-preview-lienzo" style={{ '--escala-lienzo': escalaLienzo }}>
        <Componente partido={PARTIDO_DEMO} config={config} />
      </div>
    </div>
  );
}
