import { obtenerPlantilla } from './registro';
import { PARTIDO_DEMO } from './datosDemo';
import './miniPreview.css';

export default function MiniPreviewMarcador({ plantillaId, config }) {
  const { Componente } = obtenerPlantilla(plantillaId);
  return (
    <div className="mini-preview-marco">
      <div className="mini-preview-lienzo">
        <Componente partido={PARTIDO_DEMO} config={config} />
      </div>
    </div>
  );
}
