// Cálculos del Intertanto (resumen entre cuartos), separados de la vista
// para reusarlos también en la Mesa (modal "Resumen") sin duplicar reglas.

export const CATEGORIAS_LIDERES = [
  { clave: 'pts', etiqueta: 'Puntos', corta: 'PTS' },
  { clave: 'reb', etiqueta: 'Rebotes', corta: 'REB' },
  { clave: 'ast', etiqueta: 'Asistencias', corta: 'AST' },
  { clave: 'stl', etiqueta: 'Robos', corta: 'ROB' },
];

const ordinal = (n) => `${n}°`;

// Título según el momento del partido: al terminar el reloj de un cuarto
// se nombra ese cierre (y el 2° es el entretiempo); fuera de eso, es un
// resumen "en juego".
export function tituloIntertanto(partido) {
  const periodo = Number(partido?.periodo) || 1;
  const empate = partido?.ptsLocal === partido?.ptsVisita;
  const terminado = (Number(partido?.relojSegundos) || 0) <= 0;
  if (partido?.estado === 'finalizado') return { titulo: 'Final', subtitulo: 'Resultado final' };
  if (!terminado) {
    return { titulo: 'Resumen del partido', subtitulo: periodo <= 4 ? `${ordinal(periodo)} cuarto en juego` : `Prórroga ${periodo - 4} en juego` };
  }
  if (periodo === 2) return { titulo: 'Entretiempo', subtitulo: 'Fin del 2° cuarto' };
  if (periodo < 4) return { titulo: `Fin del ${ordinal(periodo)} cuarto`, subtitulo: 'Intertanto' };
  if (empate) {
    return periodo === 4
      ? { titulo: 'Fin del 4° cuarto', subtitulo: 'Empate — se va a prórroga' }
      : { titulo: `Fin de la prórroga ${periodo - 4}`, subtitulo: 'Empate — otra prórroga' };
  }
  return { titulo: 'Final', subtitulo: periodo > 4 ? `Tras ${periodo - 4} prórroga${periodo > 5 ? 's' : ''}` : 'Resultado final' };
}

export const etiquetaColumnaPeriodo = (p) => (p <= 4 ? `Q${p}` : `OT${p > 5 ? p - 4 : ''}`);

// Tabla de puntos por cuarto: siempre muestra Q1–Q4 (aunque falten por
// jugar, con "–"), más las prórrogas que haya habido.
export function tablaPorPeriodo(partido) {
  const filas = partido?.puntosPorPeriodo || [];
  const periodoActual = Number(partido?.periodo) || 1;
  const ultimo = Math.max(4, periodoActual, ...filas.map((f) => f.periodo));
  const porNumero = new Map(filas.map((f) => [f.periodo, f]));
  const columnas = [];
  for (let p = 1; p <= ultimo; p++) {
    const fila = porNumero.get(p);
    const jugado = p <= periodoActual;
    columnas.push({
      periodo: p,
      etiqueta: etiquetaColumnaPeriodo(p),
      local: jugado ? (fila?.local ?? 0) : null,
      visita: jugado ? (fila?.visita ?? 0) : null,
      actual: p === periodoActual,
    });
  }
  return columnas;
}

const tieneNomina = (equipo) => Array.isArray(equipo?.roster) && equipo.roster.length > 0;

function sumar(roster, clave) {
  return roster.reduce((acc, j) => acc + (Number(j[clave]) || 0), 0);
}

// Comparativa de equipo — solo tiene sentido si las DOS nóminas están
// cargadas (los totales salen de sumar jugadores; sin nómina, las jugadas
// quedan a nivel de equipo y compararían contra 0).
export function comparativaEquipos(partido) {
  const { equipoLocal: l, equipoVisita: v } = partido || {};
  if (!tieneNomina(l) || !tieneNomina(v)) return [];
  const fila = (etiqueta, a, b, { menosEsMejor = false, sufijo = '' } = {}) => ({ etiqueta, local: a, visita: b, menosEsMejor, sufijo });
  const tl = (r) => {
    const fta = sumar(r, 'fta');
    return fta > 0 ? Math.round((sumar(r, 'ftm') / fta) * 100) : null;
  };
  const filas = [
    fila('Rebotes', sumar(l.roster, 'reb'), sumar(v.roster, 'reb')),
    fila('Asistencias', sumar(l.roster, 'ast'), sumar(v.roster, 'ast')),
    fila('Robos', sumar(l.roster, 'stl'), sumar(v.roster, 'stl')),
    fila('Triples', sumar(l.roster, 'fg3m'), sumar(v.roster, 'fg3m')),
    fila('Pérdidas', sumar(l.roster, 'to'), sumar(v.roster, 'to'), { menosEsMejor: true }),
    fila('Faltas', sumar(l.roster, 'faltas'), sumar(v.roster, 'faltas'), { menosEsMejor: true }),
  ];
  const tlL = tl(l.roster);
  const tlV = tl(v.roster);
  if (tlL != null || tlV != null) filas.splice(4, 0, fila('Tiros libres', tlL ?? 0, tlV ?? 0, { sufijo: '%' }));
  return filas;
}

// Líder de una categoría para un equipo: el de valor más alto (desempata
// por puntos y después por dorsal). Sin nómina → `sinNomina`; con nómina
// pero nadie sumó nada todavía → null.
function liderDe(equipo, clave) {
  if (!tieneNomina(equipo)) return { sinNomina: true };
  const ordenados = [...equipo.roster].sort(
    (a, b) => (b[clave] || 0) - (a[clave] || 0) || (b.pts || 0) - (a.pts || 0) || (a.dorsal ?? 999) - (b.dorsal ?? 999)
  );
  const mejor = ordenados[0];
  if (!mejor || !(mejor[clave] > 0)) return null;
  return { jugador: mejor, valor: mejor[clave] };
}

export function lideresPartido(partido, claves = ['pts', 'reb', 'ast']) {
  const { equipoLocal: l, equipoVisita: v } = partido || {};
  if (!tieneNomina(l) && !tieneNomina(v)) return [];
  return CATEGORIAS_LIDERES.filter((c) => claves.includes(c.clave)).map((c) => ({
    ...c,
    local: liderDe(l, c.clave),
    visita: liderDe(v, c.clave),
  }));
}

export const hayNominas = (partido) => tieneNomina(partido?.equipoLocal) || tieneNomina(partido?.equipoVisita);
