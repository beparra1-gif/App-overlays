import { useRef } from 'react';
import { obtenerPlantilla } from '../registro';
import LogoMarcaAgua from '../LogoMarcaAgua';
import LogoFlotante from '../LogoFlotante';
import PopSumaPuntos from '../PopSumaPuntos';
import TituloMarcador from '../TituloMarcador';
import { useCajaMarcador } from '../utils';

// `oculto` (config.ocultarMarcador desde un disparo de Nómina/Estadísticas):
// en vez de desmontar el marcador de golpe, se lo deja siempre montado (así
// la medición de la caja — useCajaMarcador — no se pierde y no hay que
// volver a esperarla) y se anima con opacity/scale. El transform va en este
// MISMO elemento (el que ya es position:fixed;inset:0), no en un wrapper
// aparte — poner un transform en un ANCESTRO de un position:fixed le
// cambia el "containing block" a ese ancestro en vez del viewport, así que
// hacerlo acá, sobre el propio elemento fixed, evita ese problema.
export default function VistaMarcador({ partido, diseno, oculto = false }) {
  const plantillaId = diseno?.plantilla_base || 'clasico';
  const config = diseno?.config || {};
  const { Componente } = obtenerPlantilla(plantillaId);
  // Contenedor de referencia para medir dónde termina la caja REAL del
  // marcador (ver useCajaMarcador) — el título y los logos "a los costados"
  // se anclan a esa medida real, no a una aproximación. El ResizeObserver de
  // adentro del hook solo dispara con cambios de TAMAÑO — si el usuario
  // mueve el tablero (posX/posY) sin cambiarle el tamaño, el elemento no se
  // "resizea", así que hace falta además re-medir cuando cambia `config`
  // (cualquier ajuste de posición/escala/tamaño de texto) o la plantilla.
  const contenedorRef = useRef(null);
  const caja = useCajaMarcador(contenedorRef, [plantillaId, config]);
  return (
    <div
      ref={contenedorRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        transition: 'opacity .4s ease, transform .4s ease',
        opacity: oculto ? 0 : 1,
        transform: oculto ? 'scale(0.94)' : 'scale(1)',
      }}
    >
      <LogoMarcaAgua equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} config={config} />
      <Componente partido={partido} config={config} />
      <LogoFlotante equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} config={config} plantillaId={plantillaId} caja={caja} />
      <PopSumaPuntos partido={partido} config={config} />
      <TituloMarcador config={config} plantillaId={plantillaId} caja={caja} />
    </div>
  );
}
