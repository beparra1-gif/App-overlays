import { mostrar, mitadCajaProporcional } from './utils';

// Capa de fondo, detrás del marcador — se renderiza como hermano ANTES del
// componente de plantilla (mismo truco de apilado que Nómina/Estadísticas/
// Anuncios: ambos son position:fixed;inset:0, así que el orden en el DOM
// decide qué queda debajo). No toca ninguna de las 25 plantillas. Muestra
// los dos logos (local a la izquierda, visita a la derecha) para que la
// marca de agua represente a ambos equipos, no solo al local.
//
// Confinada al área APROXIMADA de la caja del marcador (mismo cálculo
// mitadCajaProporcional que usa el resto del archivo) en vez de a toda la
// pantalla — "marca de agua" tiene que quedar DENTRO del marcador, no
// ocupando la transmisión entera. `logoTamanoFondo` pasa a ser % del ANCHO
// DE LA CAJA (no de la pantalla), así que sigue siendo "agrandar/achicar"
// pero relativo a lo que ahora la contiene. `top`/`height` en % SÍ son
// relativos al alto real del contenedor (a diferencia de padding-top), así
// que acá no hace falta la corrección de aspect-ratio.
export default function LogoMarcaAgua({ equipoLocal, equipoVisita, config }) {
  if (config?.logoPosicion !== 'fondo') return null;
  if (!mostrar(config, 'mostrarLogo')) return null;
  const opacidadRaw = Number.isFinite(config?.logoOpacidadMarcador) ? config.logoOpacidadMarcador : config?.logoOpacidad;
  const opacidad = Number.isFinite(opacidadRaw) ? opacidadRaw / 100 : 0.35;
  const anchoPct = Number(config?.logoTamanoFondo) || 30;

  const posX = Number.isFinite(config?.posX) ? config.posX : 50;
  const posY = Number.isFinite(config?.posY) ? config.posY : 88;
  const mitad = mitadCajaProporcional(config);

  return (
    <div
      style={{
        position: 'fixed',
        left: `${Math.max(0, posX - mitad.x)}%`,
        top: `${Math.max(0, posY - mitad.y)}%`,
        width: `${mitad.x * 2}%`,
        height: `${mitad.y * 2}%`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {equipoLocal?.logo_url && (
        <img src={equipoLocal.logo_url} alt="" style={{ width: `${anchoPct}%`, maxWidth: '45%', objectFit: 'contain', opacity: opacidad }} />
      )}
      {equipoVisita?.logo_url && (
        <img src={equipoVisita.logo_url} alt="" style={{ width: `${anchoPct}%`, maxWidth: '45%', objectFit: 'contain', opacity: opacidad }} />
      )}
    </div>
  );
}
