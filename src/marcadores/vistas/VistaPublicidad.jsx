import { usePatrocinadorActual, varsPaletaTablero } from '../utils';
import '../publicidad.css';

// Publicidad en las pausas (tiempo muerto, intertanto, entretiempo): los
// patrocinadores activos (página Publicidad) rotan en una tarjeta grande con
// los colores y la forma del tablero en pantalla.
// `esquina`: mientras hay un panel grande en pantalla (intertanto, final…) va arriba a la derecha, sin taparlo.
export default function VistaPublicidad({ patrocinadores, caja, saliendo = false, esquina = false }) {
  const actual = usePatrocinadorActual(patrocinadores);
  if (!actual) return null;
  const p = caja?.paleta;
  return (
    <div className={`pub-pausa ${esquina ? 'pub-esquina' : ''} ${saliendo ? 'pub-saliendo' : ''}`} style={{ ...varsPaletaTablero(caja), ...(p ? { '--pub-radio': p.radio, '--pub-borde': p.borde } : {}) }}>
      <span className="pub-etiqueta">Auspicia</span>
      <img key={actual.id} src={actual.imagen_url} alt={actual.nombre} />
    </div>
  );
}
