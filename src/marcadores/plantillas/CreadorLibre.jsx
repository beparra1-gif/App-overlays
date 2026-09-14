import { estiloPersonalizado } from '../utils';
import '../plantillas.css';

// El lienzo en blanco de verdad: sin logo/nombre/puntos fijos como las
// otras 33 plantillas — el diseño completo se arma en Personalizar diseño
// → Creador, agregando y arrastrando "Elementos libres" (ver
// ElementosLibres.jsx) uno por uno. Es la respuesta al pedido de "una
// especie de Canva, pero solo para marcadores": acá no hay ninguna forma
// ni color de fábrica que sacarse de encima, solo lo que el usuario
// decida poner.
export default function CreadorLibre({ config }) {
  return <div className="plantilla-marcador pcl-wrap" style={estiloPersonalizado(config)} />;
}
