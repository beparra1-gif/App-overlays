import { useRef } from 'react';
import { obtenerPlantilla } from '../registro';
import LogoMarcaAgua from '../LogoMarcaAgua';
import LogoFlotante from '../LogoFlotante';
import PopSumaPuntos from '../PopSumaPuntos';
import TituloMarcador from '../TituloMarcador';
import LogosLibres from '../LogosLibres';
import { useCajaMarcador } from '../utils';

// Referencia ESTABLE para "sin config" — `diseno?.config || {}` con un
// literal `{}` crea un objeto NUEVO en cada render; como `config` viaja como
// dependencia de useCajaMarcador (línea de abajo), un partido sin diseño
// asignado (diseno undefined/null) entraba en loop infinito: cada render
// "cambiaba" la dependencia → el efecto medía de nuevo → setCaja con un
// objeto nuevo → nuevo render → config de nuevo `{}` fresco → de nuevo
// "cambiada" → así sin parar ("Maximum update depth exceeded"). Reusar
// SIEMPRE el mismo objeto vacío corta el loop en la raíz.
const CONFIG_VACIA = {};

// `oculto` (config.ocultarMarcador desde un disparo de Nómina/Estadísticas):
// en vez de desmontar el marcador de golpe, se lo deja siempre montado (así
// la medición de la caja — useCajaMarcador — no se pierde y no hay que
// volver a esperarla) y se anima con opacity/scale. El transform va en este
// MISMO elemento (el que ya es position:fixed;inset:0), no en un wrapper
// aparte — poner un transform en un ANCESTRO de un position:fixed le
// cambia el "containing block" a ese ancestro en vez del viewport, así que
// hacerlo acá, sobre el propio elemento fixed, evita ese problema.
export default function VistaMarcador({ partido, diseno, oculto = false, suprimirTitulo = false }) {
  const plantillaId = diseno?.plantilla_base || 'clasico';
  const config = diseno?.config || CONFIG_VACIA;
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
      <LogoMarcaAgua equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} config={config} caja={caja} />
      <Componente partido={partido} config={config} />
      <LogoFlotante equipoLocal={partido.equipoLocal} equipoVisita={partido.equipoVisita} config={config} plantillaId={plantillaId} caja={caja} />
      <PopSumaPuntos partido={partido} config={config} caja={caja} />
      <TituloMarcador config={config} plantillaId={plantillaId} caja={caja} suprimir={suprimirTitulo} />
      <LogosLibres config={config} />
    </div>
  );
}
