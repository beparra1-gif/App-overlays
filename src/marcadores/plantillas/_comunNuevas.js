// Helpers compartidos por las plantillas nuevas (Brutalista, Suizo, Torre,
// Momentum, Media cancha, Sticker Pop, Terminal).
export const sigla = (equipo) => (equipo?.codigo || equipo?.nombre || '').slice(0, 3).toUpperCase();
export const colorEquipo = (equipo, porDefecto) => equipo?.color || porDefecto;
export const faltasTexto = (partido, lado) => (lado === 'local' ? partido.faltasPeriodoLocal : partido.faltasPeriodoVisita) ?? 0;
export const enBonus = (partido, lado) => Boolean(lado === 'local' ? partido.bonusLocal : partido.bonusVisita);
export const tienePosesion = (partido, lado) => partido.posesion === lado;
