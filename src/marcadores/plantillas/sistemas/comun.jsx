import { usePulso, usePulsoConDelta, mostrar, indicadorFaltas, logoAdentro, useRelojPosesion, formatearPosesion } from '../../utils';
import LogoEquipo from '../../LogoEquipo';

// Piezas compartidas por los "sistemas" de marcador (cada uno con su propia
// identidad completa: marcador + nómina + estadísticas + intertanto +
// anuncios, ver temasSistemas.css).
export const equipoDe = (partido, lado) => (lado === 'local' ? partido.equipoLocal : partido.equipoVisita);
export const ptsDe = (partido, lado) => (lado === 'local' ? partido.ptsLocal : partido.ptsVisita);
export const faltasDe = (partido, lado) => (lado === 'local' ? partido.faltasPeriodoLocal : partido.faltasPeriodoVisita) ?? 0;
export const bonusDe = (partido, lado) => Boolean(lado === 'local' ? partido.bonusLocal : partido.bonusVisita);
export const timeoutsDe = (partido, lado) => (lado === 'local' ? partido.timeoutsLocal : partido.timeoutsVisita) ?? 0;
export const sigla = (equipo) => (equipo?.codigo || equipo?.nombre || '').slice(0, 3).toUpperCase();
export const colorDe = (partido, lado) => equipoDe(partido, lado)?.color || (lado === 'local' ? '#e11d48' : '#2563eb');
export const posesion = (partido, config, lado) => mostrar(config, 'mostrarPosesion') && partido.posesion === lado;

export function Pts({ partido, lado, className = '' }) {
  const pts = ptsDe(partido, lado);
  const pulso = usePulso(pts);
  return <span className={`${className} ${pulso ? 'pm-pulso' : ''}`}>{pts}</span>;
}

export function Faltas({ partido, config, lado, className = '', prefijo = 'F' }) {
  if (!mostrar(config, 'mostrarFaltas')) return null;
  const bonus = bonusDe(partido, lado);
  return (
    <span className={`${className} ${bonus ? 'pm-bonus' : ''}`}>
      {bonus ? 'BONUS' : `${prefijo}${prefijo ? ' ' : ''}${indicadorFaltas(faltasDe(partido, lado), config?.estiloFaltas)}`}
    </span>
  );
}

export function Logo({ partido, config, lado, className }) {
  return <LogoEquipo equipo={equipoDe(partido, lado)} config={config} className={className} />;
}

// Medallón: el logo dentro de un círculo del color del equipo (todos del
// mismo tamaño, se vean como se vean los escudos); sin logo, la sigla.
export function Medallon({ partido, config, lado, className = '' }) {
  const equipo = equipoDe(partido, lado);
  const conLogo = equipo?.logo_url && logoAdentro(config);
  return (
    <span className={`sx-medallon ${className}`} style={{ '--sx-equipo': colorDe(partido, lado) }}>
      {conLogo ? <LogoEquipo equipo={equipo} config={{ ...config, logoPosicion: 'costado' }} className="sx-medallon-logo" /> : sigla(equipo)}
    </span>
  );
}

// Pastillas de tiempos muertos restantes (máximo 5 dibujadas).
export function Timeouts({ partido, lado, className = '', total = 3 }) {
  const restantes = timeoutsDe(partido, lado);
  return (
    <span className={`sx-timeouts ${className}`} aria-label={`${restantes} tiempos muertos`}>
      {Array.from({ length: Math.min(5, Math.max(total, restantes)) }).map((_, i) => <i key={i} className={i < restantes ? 'on' : ''} />)}
    </span>
  );
}

// "+2"/"+3" que salta del marcador cuando un equipo anota.
export function Reaccion({ partido, lado, className = '' }) {
  const { pulso, delta, clave } = usePulsoConDelta(ptsDe(partido, lado));
  if (!pulso || delta <= 0) return null;
  return <span key={clave} className={`sx-reaccion ${className}`}>+{delta}</span>;
}

export const lider = (equipo, clave = 'pts') => {
  const roster = equipo?.roster || [];
  if (!roster.length) return null;
  const mejor = [...roster].sort((a, b) => (b[clave] || 0) - (a[clave] || 0))[0];
  return mejor && mejor[clave] > 0 ? mejor : null;
};

// Período con ordinal en español para las barras de TV: ['3', 'ER'], ['OT', '1'].
export const ordinalPeriodo = (p = 1) => (p <= 4 ? [String(p), ['ER', 'DO', 'ER', 'TO'][p - 1]] : ['OT', String(p - 4)]);

// Escudo de la competencia / canal: el primer "logo libre" del diseño.
export const logoCompetencia = (config) => (Array.isArray(config?.logosLibres) ? config.logosLibres[0]?.logoUrl : null) || null;

// Reloj de posesión dibujado DENTRO del tablero (diseños con relojPosesionPropio
// en soporte.js). Como en FIBA, se apaga cuando al reloj de juego le queda menos.
export function Posesion24({ partido, config, className = '' }) {
  const valor = useRelojPosesion(partido);
  if (!config?.mostrarRelojPosesion) return null;
  const juego = Number(partido.relojSegundos);
  const apagado = Number.isFinite(juego) && juego > 0 && juego < valor;
  return <span className={`${className} ${valor < 5 ? 'pm-24-alerta' : ''}`}>{apagado ? '' : formatearPosesion(valor)}</span>;
}

// Texto del pie de las barras de TV: el título del diseño (si va adentro) o "EN VIVO".
export const tituloAdentro = (config) => {
  const texto = (config?.tituloTexto || '').trim();
  return config?.mostrarTitulo && texto && (config.tituloPosicion || 'arriba') !== 'libre' ? texto : null;
};
