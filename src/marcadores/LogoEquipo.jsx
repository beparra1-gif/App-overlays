import { mostrar } from './utils';

// Tamaño/transparencia INDEPENDIENTES por contexto — agrandar el logo del
// marcador no debe tocar el de la Nómina ni el de Estadísticas, y viceversa.
// El contexto por defecto es 'marcador' porque es, por lejos, el que más se
// usa (las 25 plantillas llaman a este componente sin pasar `contexto`).
// El fallback a `logoTamano`/`logoOpacidad` (los campos viejos, únicos)
// es para que un diseño guardado antes de esta separación no pierda el
// tamaño que ya tenía configurado.
const CAMPOS_POR_CONTEXTO = {
  marcador: { tamano: 'logoTamanoMarcador', opacidad: 'logoOpacidadMarcador' },
  nomina: { tamano: 'logoTamanoNomina', opacidad: 'logoOpacidadNomina' },
  estadisticas: { tamano: 'logoTamanoEstadisticas', opacidad: 'logoOpacidadEstadisticas' },
};

export default function LogoEquipo({ equipo, config, className, contexto = 'marcador' }) {
  if (!mostrar(config, 'mostrarLogo') || !equipo?.logo_url) return null;
  // El logo "de adentro" del marcador (pegado al nombre del equipo, en cada
  // una de las 25 plantillas) solo va acá cuando la posición elegida es
  // "costado" — con "arriba"/"abajo"/"fondo" el mismo logo se muestra
  // flotando (LogoFlotante) o de fondo (LogoMarcaAgua) en su lugar. Si acá
  // no se corta, quedaban los dos logos a la vez (el de adentro Y el nuevo).
  if (contexto === 'marcador' && (config?.logoPosicion || 'costado') !== 'costado') return null;
  const campos = CAMPOS_POR_CONTEXTO[contexto] || CAMPOS_POR_CONTEXTO.marcador;
  const tam = Number(config?.[campos.tamano]) || Number(config?.logoTamano) || 40;
  const opacidadRaw = Number.isFinite(config?.[campos.opacidad]) ? config[campos.opacidad] : config?.logoOpacidad;
  const opacidad = Number.isFinite(opacidadRaw) ? opacidadRaw / 100 : 1;
  // Solo se fija la ALTURA — el ancho queda proporcional al logo real. Antes
  // se forzaba un cuadrado (width = height) y el escudo quedaba "flotando"
  // adentro con relleno invisible a los costados (o arriba/abajo) cuando no
  // era cuadrado; así, cualquier logo queda a la misma altura que el resto
  // sin ese marco vacío.
  return <img src={equipo.logo_url} alt="" className={className} style={{ height: tam, width: 'auto', maxWidth: tam * 1.8, objectFit: 'contain', opacity: opacidad }} />;
}
