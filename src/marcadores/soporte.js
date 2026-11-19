import { idBasePlantilla } from './utils';

// Qué opciones del panel "Personalizar" respeta de verdad cada tablero.
// Cada diseño tiene su propia identidad: algunos no dibujan faltas, otros
// no tienen lugar para el escudo, o lo dibujan dentro de una forma fija
// (medallón, chip) donde no tiene sentido sacarlo "arriba" o "de fondo".
// El panel usa esto para mostrar solo los controles que hacen algo, en vez
// de dejar perillas que no cambian nada en pantalla.

const SIN_FALTAS = new Set(['corner-min', 'nba', 'record-block', 'creador-libre']);
const SIN_ESTILO_FALTAS = new Set([...SIN_FALTAS, 'terminal', 'torre-lateral', 'modular']);
const CON_POSESION = new Set([
  'clasico', 'broadcast-bonus', 'brutalista', 'compacto-tofo', 'euro-divider', 'media-cancha', 'momentum', 'nba',
  'pildora-doble', 'record-block', 'split', 'sticker-pop', 'suizo', 'terminal', 'torre-lateral',
  // Todos los "sistemas" dibujan la posesión con su propio recurso.
  'crossover', 'foco-arena', 'pizarra-tactica', 'ticket-recibo', 'cromo-coleccionable', 'metro', 'tablero-paletas',
  'afiche-riso', 'noventero', 'pulso-partido', 'foto-protagonista', 'gran-titular', 'apilado-reacciones', 'modular',
  'escudo-torneo', 'alas-trapecio', 'cartel-rasgado',
]);
// Sin escudo de equipo (usan sigla, foto o el logo de la competencia).
const SIN_LOGO = new Set(['retro-led', 'metro', 'foto-protagonista', 'pulso-partido', 'tablero-paletas', 'escudo-torneo', 'creador-libre']);
// Barras de ancho completo: siempre ocupan el borde de la pantalla.
const BARRA_COMPLETA = new Set(['ticker', 'espn-ticker', 'broadcast-bonus']);

export function soporteDePlantilla(plantillaId) {
  const id = idBasePlantilla(plantillaId);
  return {
    faltas: !SIN_FALTAS.has(id),
    estiloFaltas: !SIN_ESTILO_FALTAS.has(id),
    posesion: CON_POSESION.has(id),
    // Sin escudo propio igual se pueden mostrar afuera (arriba/abajo/costados/libre).
    logoAdentro: !SIN_LOGO.has(id),
    posicionLibre: !BARRA_COMPLETA.has(id),
    nombreFlotante: id === 'clasico',
    formaPropia: id === 'personalizado',
  };
}
