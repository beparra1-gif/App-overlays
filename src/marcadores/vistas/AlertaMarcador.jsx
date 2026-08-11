import { useLayoutEffect, useRef, useState } from 'react';
import { estiloTema, estiloTemaCapa, familiaDePlantilla, familiaEfectiva, fuenteEfectiva } from '../utils';
import '../alertaMarcador.css';

// Ancho/alto de referencia del lienzo (1920×1080) — a esa proporción, 1vh
// equivale a 1080/1920 = 0.5625vw. Se usa para partir de un tamaño de letra
// proporcional al ALTO de la caja (en vw, para no depender de container
// query units — soporte parejo en cualquier WebView que use OBS).
const VH_A_VW = 1080 / 1920;

function tamanoBasePorAlto(caja) {
  return Math.min(Math.max(caja.heightAlto * 0.5 * VH_A_VW, 1.1), 7.5);
}

// Sustituye al marcador (que sigue oculto detrás, ver `ocultarMarcadorAhora`
// en EscenaPublica) por un cartel del MISMO tamaño y en el MISMO lugar de la
// caja real — medida por useCajaMarcador. Dos estilos distintos según de
// qué evento se trata:
// - "Entretiempo" (`equipo` vacío): un estado del PARTIDO, no de un equipo
//   puntual — sigue el estilo GENERAL del diseño (mismos colores/tipografía/
//   familia visual que el propio marcador, ver estiloTema/familiaDePlantilla).
// - "Minuto solicitado" (`equipo` local/visita): un AVISO de un evento de
//   juego — sigue el mismo criterio que Anuncios (estiloTemaCapa/familia de
//   esa capa), con el borde del color del equipo que lo pidió como acento,
//   igual que ya hacen los avisos de jugadas (--anuncio-color-equipo).
export default function AlertaMarcador({ texto, subtitulo, equipo, caja, config = {}, plantillaId, colorLocal, colorVisita }) {
  const cajaRef = useRef(null);
  const textoRef = useRef(null);
  const [escala, setEscala] = useState(1);

  // El tamaño de letra de arriba (tamanoBasePorAlto) solo mira el ALTO de la
  // caja — para el ANCHO se MIDE el texto ya renderizado (scrollWidth)
  // contra el ancho disponible y, si no entra, se lo achica con
  // transform:scale — exacto sea cual sea la fuente/idioma/largo del texto.
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

  const esAviso = Boolean(equipo);
  const familia = esAviso ? familiaEfectiva(config, 'anuncios', plantillaId) : familiaDePlantilla(plantillaId);
  const colorEquipo = equipo === 'local' ? colorLocal : equipo === 'visita' ? colorVisita : null;

  const estiloCaja = {
    ...estiloTema(config),
    ...(esAviso ? estiloTemaCapa(config, 'anuncios') : {}),
    '--pm-fuente': fuenteEfectiva(config, plantillaId),
    ...(colorEquipo ? { '--anuncio-color-equipo': colorEquipo } : {}),
    left: `${caja.left}%`,
    top: `${caja.topAlto}%`,
    width: `${caja.width}%`,
    height: `${caja.heightAlto}%`,
  };

  return (
    <div ref={cajaRef} className={`alerta-marcador fam-${familia} ${esAviso ? 'alerta-aviso' : 'alerta-general'}`} style={estiloCaja}>
      {subtitulo && <span className="alerta-marcador-subtitulo">{subtitulo}</span>}
      <span
        ref={textoRef}
        className="alerta-marcador-texto"
        style={{ fontSize: `${tamanoBasePorAlto(caja)}vw`, transform: `scale(${escala})` }}
      >
        {texto}
      </span>
    </div>
  );
}
