import { estiloTema, estiloUbicacion, familiaDePlantilla, fuenteDePlantilla } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../nomina.css';

// Titulares (quinteto en cancha) primero, banca después — dentro de cada
// grupo se mantiene el orden que ya traía el roster (dorsal/nombre). Así se
// lee de un vistazo quién arranca sin tener que buscar la insignia fila por
// fila en una lista de 12.
function conTitularesPrimero(roster, quintetoIds) {
  const titulares = roster.filter((j) => quintetoIds.includes(j.id));
  const banca = roster.filter((j) => !quintetoIds.includes(j.id));
  return [...titulares, ...banca];
}

export default function VistaNomina({ partido, modo = 'ambos', claveAnimacion = 0, config, plantillaId }) {
  // Nómina COMPLETA (antes solo se mostraba el quinteto en cancha) — quien
  // está arrancando en cancha se distingue con una insignia en su fila, no
  // ocultando al resto del plantel.
  const rosterLocal = conTitularesPrimero(partido.equipoLocal.roster, partido.quintetoLocalIds);
  const rosterVisita = conTitularesPrimero(partido.equipoVisita.roster, partido.quintetoVisitaIds);
  const mostrarLocal = modo === 'local' || modo === 'ambos';
  const mostrarVisita = modo === 'visita' || modo === 'ambos';
  const conEstadisticas = config?.nominaConEstadisticas === true;
  const mostrarLogo = config?.logoEnNomina !== false;
  // 'costado' (por defecto): chico, junto al nombre — comportamiento de
  // siempre. 'fondo': grande, detrás de toda la nómina de ese equipo, como
  // mínimo tan alto como la nómina misma (ver nominaLogoFondoTamano, 100%
  // = esa altura exacta, más se lo puede agrandar para que sobresalga).
  const logoDeFondo = mostrarLogo && (config?.nominaLogoPosicion || 'costado') === 'fondo';
  const opacidadLogo = (Number.isFinite(config?.logoOpacidadNomina) ? config.logoOpacidadNomina : 100) / 100;
  const altoLogoFondo = Math.max(100, Number(config?.nominaLogoFondoTamano) || 130);
  const familia = familiaDePlantilla(plantillaId);
  // Techo de ancho para el logo de fondo — antes, con un logo bien ancho (o
  // el tamaño llevado a 200%) podía crecer tanto que se metía en la zona del
  // OTRO equipo y los dos escudos quedaban superpuestos. Con esto, cada uno
  // queda confinado a su propia mitad de la pantalla como mucho.
  const maxAnchoLogoFondo = '32vw';
  // Igual que en Estadísticas: si se dispara SOLO un equipo, la nómina sale
  // pegada a SU lado de la pantalla (local ⇒ izquierda, visita ⇒ derecha) en
  // vez del lugar fijo del diseño. Si se dispara "ambos", se respeta la
  // ubicación configurada, como ya estaba.
  const ubicacion = modo === 'local' ? 'izquierda' : modo === 'visita' ? 'derecha' : config?.nominaPosicion;
  const estilo = { ...estiloTema(config), ...estiloUbicacion(ubicacion), '--pm-fuente': fuenteDePlantilla(plantillaId) };

  // El delay del "entra deslizando" se achica con listas más largas (plantel
  // completo, hasta 12) para que no tarde años en aparecer el último — antes
  // solo eran 5 (el quinteto), 0.15s por fila alcanzaba.
  const filaJugador = (quintetoIds) => (j, idx) => {
    const enCancha = quintetoIds.includes(j.id);
    return (
      <div className={`nomina-jugador ${conEstadisticas ? 'con-stats' : ''} ${enCancha ? 'en-cancha' : ''}`} key={j.id} style={{ animationDelay: `${Math.min(idx, 12) * 0.07}s` }}>
        <span className="nomina-dorsal">{j.dorsal ?? '-'}</span>
        <span className="nomina-nombre">{j.nombre}</span>
        {enCancha && <span className="nomina-insignia" title="En cancha">★</span>}
        {conEstadisticas && <span className="nomina-stats">{j.pts ?? 0} PTS · {j.reb ?? 0} REB · {j.ast ?? 0} AST</span>}
      </div>
    );
  };

  // `estiloUbicacion` (alignItems/justifyContent en `estilo`) decide DÓNDE
  // va todo el bloque de nómina en la pantalla (arriba/abajo/centro) — ese
  // alignItems, si viviera en la MISMA fila que las dos columnas, también
  // las cruzaría entre sí (centradas o al piso cada una según su propia
  // altura), así que con 13 jugadores de un lado y 12 del otro los
  // encabezados quedaban a distinta altura. Por eso el "quién va dónde en
  // la pantalla" vive en .nomina-overlay (afuera) y el "las dos columnas
  // arrancan parejas arriba" vive en .nomina-fila (adentro, siempre
  // flex-start), cada uno en su propio nivel de flex.
  return (
    <div className={`nomina-overlay fam-${familia}`} key={claveAnimacion} style={estilo}>
      <div className="nomina-fila">
        {mostrarLocal && (
          <div className="nomina-equipo">
            {logoDeFondo && partido.equipoLocal.logo_url && (
              <img className="nomina-logo-fondo" src={partido.equipoLocal.logo_url} alt="" style={{ height: `${altoLogoFondo}%`, maxWidth: maxAnchoLogoFondo, opacity: opacidadLogo }} />
            )}
            <div className="nomina-encabezado-equipo" style={{ color: partido.equipoLocal.color }}>
              {mostrarLogo && !logoDeFondo && <LogoEquipo equipo={partido.equipoLocal} config={config} className="nomina-logo" contexto="nomina" />}
              <span className="nomina-titulo">{partido.equipoLocal.nombre}</span>
            </div>
            {rosterLocal.map(filaJugador(partido.quintetoLocalIds))}
          </div>
        )}
        {mostrarVisita && (
          <div className="nomina-equipo nomina-visita">
            {logoDeFondo && partido.equipoVisita.logo_url && (
              <img className="nomina-logo-fondo" src={partido.equipoVisita.logo_url} alt="" style={{ height: `${altoLogoFondo}%`, maxWidth: maxAnchoLogoFondo, opacity: opacidadLogo }} />
            )}
            <div className="nomina-encabezado-equipo" style={{ color: partido.equipoVisita.color }}>
              {mostrarLogo && !logoDeFondo && <LogoEquipo equipo={partido.equipoVisita} config={config} className="nomina-logo" contexto="nomina" />}
              <span className="nomina-titulo">{partido.equipoVisita.nombre}</span>
            </div>
            {rosterVisita.map(filaJugador(partido.quintetoVisitaIds))}
          </div>
        )}
      </div>
    </div>
  );
}
