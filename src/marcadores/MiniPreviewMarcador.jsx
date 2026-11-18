import { useRef } from 'react';
import { obtenerPlantilla } from './registro';
import { PARTIDO_DEMO } from './datosDemo';
import { useCajaMarcador, useEscalaLienzo } from './utils';
import LogosLibres from './LogosLibres';
import ElementosLibres from './ElementosLibres';
import './miniPreview.css';

// Cuánto del ancho/alto de la miniatura puede ocupar el marcador una vez
// enfocado, y el zoom máximo (para no pixelar plantillas muy chicas).
const OCUPACION_ENFOCADO = 0.78;
const ZOOM_MAXIMO = 4;

// Miniatura del catálogo. Antes mostraba el lienzo entero de 1920×1080
// escalado: el marcador quedaba como un puntito en una esquina y no se
// podían comparar los diseños. Con `enfocar` (por defecto) se mide la caja
// real del marcador y se hace zoom sobre ella, centrada.
export default function MiniPreviewMarcador({ plantillaId, config, enfocar = true }) {
  const { Componente } = obtenerPlantilla(plantillaId);
  const marcoRef = useRef(null);
  const lienzoRef = useRef(null);
  const escalaLienzo = useEscalaLienzo(marcoRef);
  const caja = useCajaMarcador(lienzoRef, [plantillaId, config]);

  let escala = escalaLienzo;
  let pan = { x: 0, y: 0 };
  if (enfocar && caja && caja.width > 0 && caja.heightAlto > 0) {
    const zoom = Math.min(ZOOM_MAXIMO, Math.max(1, OCUPACION_ENFOCADO / Math.max(caja.width / 100, caja.heightAlto / 100)));
    const anchoMarco = escalaLienzo * 1920;
    const altoMarco = escalaLienzo * 1080;
    const cx = (caja.left + caja.width / 2) / 100;
    const cy = (caja.topAlto + caja.heightAlto / 2) / 100;
    escala = escalaLienzo * zoom;
    pan = { x: anchoMarco * (0.5 - zoom * cx), y: altoMarco * (0.5 - zoom * cy) };
  }

  return (
    <div className="mini-preview-marco mini-preview-catalogo" ref={marcoRef}>
      <div
        className="mini-preview-lienzo"
        ref={lienzoRef}
        style={{ '--escala-lienzo': escala, '--pan-x': `${pan.x}px`, '--pan-y': `${pan.y}px` }}
      >
        <Componente partido={PARTIDO_DEMO} config={config} />
        <LogosLibres config={config} contenedorRef={lienzoRef} />
        <ElementosLibres partido={PARTIDO_DEMO} config={config} contenedorRef={lienzoRef} escalaLienzo={escala} />
      </div>
    </div>
  );
}
