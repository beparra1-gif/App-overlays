import { estiloTema, estiloTemaCapa, familiaEfectiva, fuenteEfectiva } from '../utils';
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

export default function VistaNomina({ partido, modo = 'ambos', claveAnimacion = 0, config, plantillaId, saliendo = false }) {
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
  // siempre. 'fondo': grande, colgado justo abajo del título de ese
  // equipo, detrás de toda la lista (ver nominaLogoFondoTamano, más abajo,
  // y el comentario junto a altoLogoFondo).
  const logoDeFondo = mostrarLogo && (config?.nominaLogoPosicion || 'costado') === 'fondo';
  const opacidadLogo = (Number.isFinite(config?.logoOpacidadNomina) ? config.logoOpacidadNomina : 100) / 100;
  // Con el interruptor prendido, se usa el logo "de fondo" (blanco y negro
  // u otra variante) que quedó emparejado por nombre con el escudo normal
  // del equipo (ver logoFondoPara en el backend) — si ese club no tiene
  // ninguno cargado, cae solo en el logo de siempre, sin romper nada.
  const usarLogoAlternativo = config?.nominaUsarLogoFondoAlternativo === true;
  const logoFondoSrc = (equipo) => (usarLogoAlternativo && equipo.logoFondoUrl) || equipo.logo_url;
  // Antes se centraba en el alto de TODA la columna (título + lista de
  // jugadores) — con un plantel de 3 quedaba centrado casi sobre el título;
  // con uno de 12, mucho más abajo, prácticamente perdido. El ancla real
  // ahora es el título (ver .nomina-logo-fondo en nomina.css: es hijo de
  // .nomina-encabezado-equipo, no de .nomina-equipo), así que el tamaño
  // también se independiza del alto de la columna: se mide en vh (alto de
  // pantalla), no en % de un contenedor cuya altura cambiaba con la
  // cantidad de jugadores. 100% ≈ 55vh (grande, pero con margen antes de
  // chocar con el borde inferior); el tope de 220% del slider ya queda
  // clampeado por CSS (max-height) para que nunca se salga de pantalla.
  const altoLogoFondo = (Number.isFinite(config?.nominaLogoFondoTamano) ? config.nominaLogoFondoTamano : 130) * 0.55;
  const familia = familiaEfectiva(config, 'nomina', plantillaId);
  // Techo de ancho para el logo de fondo — antes, con un logo bien ancho (o
  // el tamaño llevado a 200%) podía crecer tanto que se metía en la zona del
  // OTRO equipo y los dos escudos quedaban superpuestos. Con esto, cada uno
  // queda confinado a su propia mitad de la pantalla como mucho.
  const maxAnchoLogoFondo = '32vw';
  // Por defecto la nómina arranca pegada arriba, sea cual sea la cantidad de
  // jugadores (3 o 12) o el modo (un equipo o los dos juntos) — antes el
  // disparo de un solo equipo usaba la ubicación "izquierda"/"derecha", que
  // además de mover el bloque al costado lo CENTRABA verticalmente,
  // dejándolo flotando a mitad de pantalla con un plantel corto. Ahora
  // "arriba" sigue siendo el default, pero config.nominaPosicionVertical
  // permite elegir centro/abajo a propósito si el usuario lo quiere así —
  // ya no es una regla fija, es una libertad más.
  const horizontal = modo === 'local' ? 'izquierda' : modo === 'visita' ? 'derecha' : config?.nominaPosicion;
  const justifyContent = horizontal === 'izquierda' ? 'flex-start' : horizontal === 'derecha' ? 'flex-end' : 'center';
  const vertical = config?.nominaPosicionVertical || 'arriba';
  const alignItems = vertical === 'abajo' ? 'flex-end' : vertical === 'centro' ? 'center' : 'flex-start';
  // Ajuste fino en px, ENCIMA de "Arriba/Centro/Abajo" — ese selector solo
  // da 3 puntos fijos; esto deja correr la nómina de a poco desde ahí,
  // sin tener que elegir un preset distinto para cada corrimiento chico.
  const offsetY = Number(config?.nominaOffsetY) || 0;
  const estilo = {
    ...estiloTema(config), ...estiloTemaCapa(config, 'nomina'),
    alignItems, justifyContent, '--pm-fuente': fuenteEfectiva(config, plantillaId),
    ...(offsetY ? { transform: `translateY(${offsetY}px)` } : {}),
  };

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
    <div className={`nomina-overlay fam-${familia} ${saliendo ? 'nomina-saliendo' : ''}`} key={claveAnimacion} style={estilo}>
      <div className="nomina-fila">
        {mostrarLocal && (
          <div className="nomina-equipo">
            <div className="nomina-encabezado-equipo" style={{ color: partido.equipoLocal.color }}>
              {mostrarLogo && !logoDeFondo && <LogoEquipo equipo={partido.equipoLocal} config={config} className="nomina-logo" contexto="nomina" />}
              <span className="nomina-titulo">{partido.equipoLocal.nombre}</span>
              {/* Colgado del ENCABEZADO (no de .nomina-equipo, que incluye
                  toda la lista) — así siempre arranca pegado justo debajo
                  del título, sea cual sea la cantidad de jugadores. */}
              {logoDeFondo && partido.equipoLocal.logo_url && (
                <img className="nomina-logo-fondo" src={logoFondoSrc(partido.equipoLocal)} alt="" style={{ height: `${altoLogoFondo}vh`, maxWidth: maxAnchoLogoFondo, opacity: opacidadLogo }} />
              )}
            </div>
            {rosterLocal.map(filaJugador(partido.quintetoLocalIds))}
          </div>
        )}
        {mostrarVisita && (
          <div className="nomina-equipo nomina-visita">
            <div className="nomina-encabezado-equipo" style={{ color: partido.equipoVisita.color }}>
              {mostrarLogo && !logoDeFondo && <LogoEquipo equipo={partido.equipoVisita} config={config} className="nomina-logo" contexto="nomina" />}
              <span className="nomina-titulo">{partido.equipoVisita.nombre}</span>
              {logoDeFondo && partido.equipoVisita.logo_url && (
                <img className="nomina-logo-fondo" src={logoFondoSrc(partido.equipoVisita)} alt="" style={{ height: `${altoLogoFondo}vh`, maxWidth: maxAnchoLogoFondo, opacity: opacidadLogo }} />
              )}
            </div>
            {rosterVisita.map(filaJugador(partido.quintetoVisitaIds))}
          </div>
        )}
      </div>
    </div>
  );
}
