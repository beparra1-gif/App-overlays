const ETIQUETAS_FALTA = {
  personal: 'Falta personal',
  tecnica: 'Falta técnica',
  antideportiva: 'Falta antideportiva',
  descalificante: 'Falta descalificante',
};

const dorsalNombre = (j) => (j ? `#${j.dorsal ?? '-'} ${j.nombre}` : '');

// Si la acción no trae jugador puntual (falta de equipo sin dorsal
// seleccionado, etc.) se identifica por el nombre del equipo en vez de
// dejar un espacio colgando sin nada después ("Falta personal " vacío).
const sujeto = (jugador, equipoNombre) => dorsalNombre(jugador) || equipoNombre || '';
const conSujeto = (base, jugador, equipoNombre) => {
  const s = sujeto(jugador, equipoNombre);
  return s ? `${base} ${s}` : base;
};

// Arma el texto de relato ("2PT #5 Bryana Gálvez") que consumen tanto el
// panel de Jugadas de la Mesa como la escena pública de tipo "anuncios".
// `contexto.jugador`/`jugadorEntra` ya vienen resueltos desde el roster del
// estado recién calculado (evita otra consulta a la base).
export function describirJugada(tipo, payload, contexto = {}) {
  const { jugador, jugadorEntra, equipoNombre } = contexto;

  switch (tipo) {
    case 'PUNTO':
      return conSujeto(`${payload.puntos}PT`, jugador, equipoNombre);
    case 'TIRO_LIBRE':
      return conSujeto(`Tiro libre ${payload.convertidos}/${payload.intentos}`, jugador, equipoNombre);
    case 'FALTA':
      return conSujeto(ETIQUETAS_FALTA[payload.tipoFalta] || 'Falta', jugador, equipoNombre);
    case 'REBOTE':
      return conSujeto('Rebote', jugador, equipoNombre);
    case 'ASISTENCIA':
      return conSujeto('Asistencia', jugador, equipoNombre);
    case 'ROBO':
      return conSujeto('Robo', jugador, equipoNombre);
    case 'PERDIDA':
      return conSujeto('Pérdida', jugador, equipoNombre);
    case 'SUSTITUCION':
      return `Cambio en ${equipoNombre}: entra ${dorsalNombre(jugadorEntra)}`;
    case 'TIMEOUT':
      return `Timeout ${equipoNombre}`;
    case 'PERIODO_FIJAR':
      return 'Cambia el período';
    case 'RELOJ_REINICIAR':
      return 'Reloj reiniciado';
    case 'PARTIDO_REINICIAR':
      return 'Partido reiniciado';
    default:
      return null;
  }
}
