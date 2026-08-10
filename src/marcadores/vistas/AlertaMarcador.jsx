import { useLayoutEffect, useRef, useState } from 'react';
import { hexConAlpha } from '../utils';
import '../alertaMarcador.css';

// Ancho/alto de referencia del lienzo (1920×1080, ver LIENZO_ANCHO_REFERENCIA
// en utils.js) — a esa proporción, 1vh equivale a 1080/1920 = 0.5625vw. Se usa
// para partir de un tamaño de letra proporcional al ALTO de la caja (en vw,
// para no depender de container query units — soporte parejo en cualquier
// WebView que use OBS, a diferencia de cqw/cqh).
const VH_A_VW = 1080 / 1920;

function tamanoBasePorAlto(caja) {
  return Math.min(Math.max(caja.heightAlto * 0.5 * VH_A_VW, 1.1), 7.5);
}

// Sustituye al marcador (que sigue oculto detrás, ver `ocultarMarcadorAhora`
// en EscenaPublica) por un cartel del MISMO tamaño y en el MISMO lugar de la
// caja real — medida por useCajaMarcador — para "Entretiempo" y "Minuto
// solicitado". `equipo` ('local'|'visita'|null) tiñe el cartel con el color
// de ese equipo cuando corresponde; sin equipo (entretiempo) usa el color de
// tablero del propio diseño.
export default function AlertaMarcador({ texto, subtitulo, equipo, caja, config = {}, colorLocal, colorVisita }) {
  const cajaRef = useRef(null);
  const textoRef = useRef(null);
  const [escala, setEscala] = useState(1);

  // El tamaño de letra de arriba (tamanoBasePorAlto) solo mira el ALTO de la
  // caja — calcularlo también "a ojo" para el ANCHO (largo del texto × un
  // ancho de letra supuesto) quedaba mal apenas la fuente real (Orbitron,
  // en mayúsculas, con letter-spacing) pesaba más de lo estimado: "MINUTO
  // SOLICITADO" se desbordaba por los costados de cajas angostas. Acá en
  // cambio se MIDE el ancho real ya renderizado (scrollWidth) contra el
  // ancho disponible de la caja, y si no entra, se lo achica con un
  // transform:scale — exacto sea cual sea la fuente/idioma/largo del texto,
  // en vez de adivinar.
  useLayoutEffect(() => {
    const elCaja = cajaRef.current;
    const elTexto = textoRef.current;
    if (!elCaja || !elTexto) return;
    elTexto.style.transform = 'scale(1)';
    const disponible = elCaja.clientWidth * 0.92;
    const necesario = elTexto.scrollWidth;
    setEscala(necesario > disponible && necesario > 0 ? disponible / necesario : 1);
  }, [texto, caja?.width, caja?.heightAlto]);

  if (!caja || !texto) return null;
  const colorEquipo = equipo === 'local' ? colorLocal : equipo === 'visita' ? colorVisita : null;
  const fondo = colorEquipo || config.colorTablero || '#0a0a0a';
  const colorTexto = config.colorTexto || '#ffffff';
  const estiloCaja = {
    left: `${caja.left}%`,
    top: `${caja.topAlto}%`,
    width: `${caja.width}%`,
    height: `${caja.heightAlto}%`,
    background: hexConAlpha(fondo, 94),
    borderColor: hexConAlpha(colorTexto, 70),
  };
  return (
    <div ref={cajaRef} className="alerta-marcador" style={estiloCaja}>
      {subtitulo && (
        <span className="alerta-marcador-subtitulo" style={{ color: colorTexto }}>{subtitulo}</span>
      )}
      <span
        ref={textoRef}
        className="alerta-marcador-texto"
        style={{ color: colorTexto, fontSize: `${tamanoBasePorAlto(caja)}vw`, transform: `scale(${escala})` }}
      >
        {texto}
      </span>
    </div>
  );
}
