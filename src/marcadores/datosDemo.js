// Ícono placeholder (SVG inline, sin depender de ningún archivo subido) para
// que en la vista previa se pueda ver de verdad el efecto de tamaño,
// transparencia y posición del logo — sin esto, logo_url quedaba en null y
// esos controles no se podían verificar visualmente antes de tener equipos
// reales cargados.
const logoDemo = (color) =>
  `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='46' fill='${color.replace('#', '%23')}' stroke='white' stroke-width='5'/%3E%3Cpath d='M50 4v92M4 50h92M15 15q35 35 70 0M15 85q35-35 70 0' stroke='white' stroke-width='3' fill='none'/%3E%3C/svg%3E`;

// Estado de ejemplo para las mini-previsualizaciones de la biblioteca de
// diseños — misma forma que el estado real que arma `construirEstado` en el
// backend, para que las plantillas y las 4 escenas se rendericen igual que
// en producción (con roster y quintetos, no solo el marcador).
export const PARTIDO_DEMO = {
  ptsLocal: 58,
  ptsVisita: 55,
  faltasLocal: 3,
  faltasVisita: 4,
  faltasPeriodoLocal: 3,
  faltasPeriodoVisita: 5,
  bonusLocal: false,
  bonusVisita: true,
  timeoutsLocal: 2,
  timeoutsVisita: 1,
  periodo: 3,
  relojSegundos: 245,
  posesion: 'local',
  quintetoLocalIds: [1, 2, 3, 4, 5],
  quintetoVisitaIds: [6, 7, 8, 9, 10],
  equipoLocal: {
    nombre: 'Halcones',
    color: '#0a84ff',
    logo_url: logoDemo('#0a84ff'),
    roster: [
      { id: 1, dorsal: 4, nombre: 'A. Torres', pts: 14, reb: 5, ast: 3, stl: 1, to: 2, faltas: 2 },
      { id: 2, dorsal: 7, nombre: 'Bryana Gálvez', pts: 18, reb: 2, ast: 6, stl: 2, to: 1, faltas: 1 },
      { id: 3, dorsal: 10, nombre: 'C. Muñoz', pts: 9, reb: 7, ast: 1, stl: 0, to: 1, faltas: 3 },
      { id: 4, dorsal: 12, nombre: 'D. Rojas', pts: 11, reb: 3, ast: 2, stl: 1, to: 0, faltas: 1 },
      { id: 5, dorsal: 23, nombre: 'E. Soto', pts: 6, reb: 4, ast: 1, stl: 0, to: 1, faltas: 0 },
    ],
    totales: { pts: 58, reb: 21, ast: 13, stl: 4, to: 5, faltas: 7 },
  },
  equipoVisita: {
    nombre: 'Tiburones',
    color: '#ff3b30',
    logo_url: logoDemo('#ff3b30'),
    roster: [
      { id: 6, dorsal: 3, nombre: 'F. Díaz', pts: 12, reb: 6, ast: 2, stl: 1, to: 2, faltas: 2 },
      { id: 7, dorsal: 5, nombre: 'G. Vera', pts: 15, reb: 3, ast: 4, stl: 1, to: 1, faltas: 2 },
      { id: 8, dorsal: 9, nombre: 'H. León', pts: 8, reb: 5, ast: 1, stl: 0, to: 1, faltas: 1 },
      { id: 9, dorsal: 14, nombre: 'Martina Parra', pts: 10, reb: 2, ast: 3, stl: 2, to: 0, faltas: 0 },
      { id: 10, dorsal: 21, nombre: 'J. Bravo', pts: 10, reb: 4, ast: 1, stl: 0, to: 2, faltas: 1 },
    ],
    totales: { pts: 55, reb: 20, ast: 11, stl: 4, to: 6, faltas: 6 },
  },
  patrocinadores: [],
};

export const JUGADAS_DEMO = [
  { texto: '2PT #7 Bryana Gálvez', tipo: 'PUNTO', equipo: 'local', ts: 3 },
  { texto: 'Falta personal #14 Martina Parra', tipo: 'FALTA', equipo: 'visita', ts: 2 },
  { texto: 'Rebote #10 C. Muñoz', tipo: 'REBOTE', equipo: 'local', ts: 1 },
];
