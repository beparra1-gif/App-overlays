import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api, urlLogo } from '../api/client';
import SelectorLogo from './SelectorLogo';
import EquipoRoster from './EquipoRoster';

// Resuelve un nombre de equipo escrito a mano contra la biblioteca ya
// guardada: si coincide EXACTO (sin importar mayúsculas) con un equipo que
// ya existe, lo reusa entero (mismo id/color/logo) — así no se duplica un
// equipo por un tipeo de mayúsculas. Si no hay coincidencia, recién ahí se
// crea en la base — no en cada tecla, solo cuando hace falta un id real.
export async function resolverOCrearEquipo({ nombre, color, logoUrl, equipos }) {
  const limpio = (nombre || '').trim();
  if (!limpio) return null;
  const existente = equipos.find((e) => e.nombre.trim().toLowerCase() === limpio.toLowerCase());
  if (existente) return existente;
  const { equipo } = await api.crearEquipo({ nombre: limpio, color: color || '#0a84ff', logo_url: logoUrl || null });
  return equipo;
}

// Paleta acotada de tonos para el color del equipo — mostrar el código hex
// no le sirve a nadie acá, alcanza con poder tocar un tono y verlo asignado.
// "Otro tono" queda como una rueda de color nativa, pero sin exponer el
// código en ningún lado: es solo para el caso de necesitar algo fuera de
// la paleta (el color de la camiseta de un club puntual, por ejemplo).
const PALETA_COLORES_EQUIPO = [
  '#0a84ff', '#ff3b30', '#34c759', '#ff9500', '#ffd60a', '#af52de',
  '#ff2d55', '#5ac8fa', '#30d158', '#a2845e', '#8e8e93', '#1c1c1e',
];

function SelectorColorEquipo({ color, onChange }) {
  return (
    <div className="selector-color-equipo">
      <span className="selector-color-equipo-actual" style={{ background: color }} title="Color actual del equipo" />
      <div className="selector-color-equipo-paleta">
        {PALETA_COLORES_EQUIPO.map((c) => (
          <button
            key={c}
            type="button"
            className={`selector-color-equipo-swatch ${c.toLowerCase() === (color || '').toLowerCase() ? 'activo' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            title="Elegir este color"
          />
        ))}
        <label className="selector-color-equipo-mas" title="Elegir otro tono">
          🎨
          <input type="color" value={color} onChange={(e) => onChange(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

// Sugiere un logo de la biblioteca cuyo nombre contiene (o está contenido
// en) el nombre tipeado — best-effort, siempre se puede cambiar a mano.
function sugerirLogoUrl(nombre, logos) {
  const limpio = (nombre || '').trim().toLowerCase();
  if (!limpio) return '';
  const encontrado = logos.find((l) => {
    const n = (l.nombre || '').trim().toLowerCase();
    return n && (n.includes(limpio) || limpio.includes(n));
  });
  return encontrado ? urlLogo(encontrado.filename) : '';
}

// Ficha de equipo para "Personalizar diseño → Equipos": un solo campo de
// nombre con autocompletado nativo (datalist) contra los equipos ya
// guardados, en vez de elegir "existente" o "nuevo" por separado — no hace
// falta que el equipo ya exista de antes. El equipo se resuelve (matchea o
// crea) solo, sin un botón de "confirmar": alcanza con activar el toggle de
// nómina, o con pasar a "Juego en vivo" sin haber tocado nada. Expone
// `obtener()` por ref para que la pantalla que lo contiene pueda resolverlo
// recién al armar el partido si el usuario no lo hizo antes a mano. El
// quinteto inicial NO se elige acá — eso pasó a la Mesa de control, donde
// se puede volver a ajustar en cualquier momento (p. ej. al empezar cada
// cuarto).
//
// `equipoActivo` (opcional) siembra el estado inicial con el equipo REAL que
// ya está jugando el partido activo de este diseño (si lo hay) — así, al
// reabrir el diseño, esta ficha no vuelve a mostrar "Local"/"Visita" en
// blanco sino el nombre/color/logo que el usuario ya había cargado.
// `onCambio` avisa en cada tecla (nombre/color/logo) para que la vista
// previa combinada se actualice al toque, con los datos reales.
const EquipoFicha = forwardRef(function EquipoFicha({ titulo, valorDefecto, equipoActivo, equipos, logos, onLogoSubido, onEquipoCreado, onCambio }, ref) {
  const [nombre, setNombre] = useState(equipoActivo?.nombre || valorDefecto);
  const [color, setColor] = useState(equipoActivo?.color || '#0a84ff');
  const [logoUrl, setLogoUrl] = useState(equipoActivo?.logo_url || '');
  const [logoTocado, setLogoTocado] = useState(Boolean(equipoActivo?.logo_url));
  const [equipoId, setEquipoId] = useState(equipoActivo?.id || null);
  const [roster, setRoster] = useState([]);
  const [error, setError] = useState('');
  const [resolviendo, setResolviendo] = useState(false);
  // Nómina apagada por defecto (juego rápido sin plantel) — se prende sola
  // si el equipo elegido ya tenía jugadores cargados de antes, o a mano con
  // el toggle de abajo.
  const [nominaHabilitada, setNominaHabilitada] = useState(false);

  // Si ya arrancamos con un equipo activo (partido en curso), traemos su
  // nómina de una — así "Agregar nómina" ya aparece prendido si corresponde.
  // Estos jugadores ya están guardados de verdad (vienen de la base), a
  // diferencia de los que se agreguen acá abajo mientras se arma el diseño.
  useEffect(() => {
    if (!equipoActivo?.id) return;
    let activo = true;
    api.listarJugadores(equipoActivo.id).then(({ jugadores }) => {
      if (!activo) return;
      setRoster(jugadores);
      if (jugadores.length > 0) setNominaHabilitada(true);
    }).catch(() => {});
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoActivo?.id]);

  // Mientras se arma el diseño, un jugador nuevo NO se guarda en la base al
  // tipearlo — antes cualquier nombre tipeado acá quedaba enseguida como
  // parte permanente del equipo reusable, aunque solo fuera la nómina de un
  // partido suelto de hoy. Ahora queda solo en memoria (marcado "pendiente")
  // hasta que el usuario lo guarda a propósito (guardarNominaPendiente) o
  // hasta que hace falta de verdad para jugar (obtener(), al entrar a
  // "Juego en vivo" — recién ahí la Mesa de control necesita ids reales).
  // Solo arma y devuelve el objeto pendiente — NO toca `roster` acá: quien
  // agrega de verdad a la lista es `onJugadorAgregado` (EquipoRoster ya lo
  // llama con lo que le devuelva esta función). Antes acá también se hacía
  // un setRoster propio, así que cada jugador quedaba agregado DOS veces.
  const agregarJugadorLocal = async (datos) => ({
    id: `pendiente-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...datos,
    pendiente: true,
  });

  // Recibe el equipo YA resuelto (en vez de leer equipoId del estado) para
  // no pisarse con React: si a este mismo llamado le tocó resolver() recién
  // ahora, el estado todavía no terminó de actualizarse en este render.
  const flushNominaPendiente = async (equipo, rosterActual) => {
    const pendientes = rosterActual.filter((j) => j.pendiente);
    for (const p of pendientes) {
      const { jugador } = await api.crearJugador(equipo.id, { nombre: p.nombre, dorsal: p.dorsal });
      setRoster((r) => r.map((x) => (x.id === p.id ? jugador : x)));
    }
  };

  const [guardandoNomina, setGuardandoNomina] = useState(false);
  const guardarNominaPendiente = async () => {
    if (!roster.some((j) => j.pendiente)) return;
    setGuardandoNomina(true);
    setError('');
    try {
      const equipo = equipoId ? { id: equipoId } : await resolver();
      if (!equipo) return;
      await flushNominaPendiente(equipo, roster);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoNomina(false);
    }
  };

  // Una vez que `equipoId` queda enganchado a un equipo real (por
  // `equipoActivo`, o porque `resolver()` lo creó/matcheó la primera vez),
  // NUNCA se vuelve a soltar solo — cualquier cosa que se tipee después es
  // una EDICIÓN de ese mismo equipo (ver el guardado más abajo), nunca un
  // cambio de cuál equipo es. Antes, si el texto tipeado llegaba a coincidir
  // por casualidad con el nombre de OTRO equipo ya guardado (algo viejo de
  // hace semanas, sin ninguna relación con el partido actual), esto
  // desenganchaba en silencio el equipo REAL en juego y lo reemplazaba por
  // ese otro — perdiendo el vínculo con la Mesa/transmisión que ya estaban
  // mirando ese equipo. Elegir un equipo DISTINTO ya guardado es una acción
  // que ahora solo puede pasar antes de que haya un equipoId (ver
  // resolver()), nunca como efecto secundario de escribir.

  const cambiarNombre = (valor) => {
    setNombre(valor);
    if (!logoTocado) setLogoUrl(sugerirLogoUrl(valor, logos));
  };

  const resolver = async () => {
    setError('');
    setResolviendo(true);
    try {
      // La prop `equipos` se cargó una sola vez al abrir esta pantalla y
      // puede haber quedado vieja (otra pestaña, u otro diseño resuelto
      // antes en esta misma sesión) — sin pedirla de nuevo acá, un "Local"/
      // "Visita" que YA existía no se encontraba y se creaba un duplicado
      // cada vez, así que la lista de equipos sueltos crecía sin parar.
      const equiposFrescos = await api.listarEquipos().then((d) => d.equipos).catch(() => equipos);
      const equipo = await resolverOCrearEquipo({ nombre: nombre || valorDefecto, color, logoUrl, equipos: equiposFrescos });
      if (!equipo) return null;
      onEquipoCreado(equipo);
      setNombre(equipo.nombre);
      setColor(equipo.color || color);
      setLogoUrl(equipo.logo_url || '');
      setEquipoId(equipo.id);
      const { jugadores } = await api.listarJugadores(equipo.id);
      setRoster(jugadores);
      if (jugadores.length > 0) setNominaHabilitada(true);
      return equipo;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setResolviendo(false);
    }
  };

  // Mientras haya un equipo vinculado, cualquier edición (nombre, color,
  // logo) se guarda en ESE MISMO equipo — antes, si el nombre tipeado ya
  // coincidía con uno existente, `resolver()` devolvía el equipo viejo tal
  // cual y cambiar el color o el logo no se guardaba NUNCA. Si el partido ya
  // está en curso, el cambio llega a la transmisión al instante (el backend
  // empuja un 'estado' nuevo al guardar, ver PUT /equipos/:id).
  const guardarEquipo = async () => {
    if (!equipoId) return;
    const limpio = nombre.trim();
    if (!limpio) return;
    try {
      const { equipo } = await api.actualizarEquipo(equipoId, { nombre: limpio, color, logo_url: logoUrl || null });
      onEquipoCreado(equipo);
    } catch (err) {
      setError(err.message);
    }
  };
  const temporizadorGuardadoRef = useRef(null);
  const primerGuardoRef = useRef(true);
  useEffect(() => {
    if (primerGuardoRef.current) { primerGuardoRef.current = false; return; }
    if (!equipoId) return;
    temporizadorGuardadoRef.current = setTimeout(guardarEquipo, 500);
    return () => clearTimeout(temporizadorGuardadoRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId, nombre, color, logoUrl]);

  // La vista previa combinada refleja al instante lo que se está tipeando o
  // eligiendo acá (nombre, color, logo), sin esperar a que se guarde nada.
  useEffect(() => {
    onCambio?.({ nombre: nombre || valorDefecto, color, logo_url: logoUrl || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, color, logoUrl]);

  // Activar el toggle es lo único que hace falta para cargar nómina — si el
  // equipo todavía no estaba resuelto (no hubo match ni se creó), se resuelve
  // acá mismo, sin un botón de "confirmar" aparte.
  const alternarNomina = async (activar) => {
    if (!activar) return setNominaHabilitada(false);
    if (equipoId) return setNominaHabilitada(true);
    try {
      const equipo = await resolver();
      if (equipo) setNominaHabilitada(true);
    } catch {
      // el error ya quedó mostrado por resolver()
    }
  };

  useImperativeHandle(ref, () => ({
    // Arrancar "Juego en vivo" es justo el momento en que la Mesa de
    // control necesita jugadores con id real — acá (y solo acá, si el
    // usuario no guardó la nómina a mano antes) es cuando lo pendiente pasa
    // a guardado de verdad.
    async obtener() {
      const equipo = equipoId ? { id: equipoId } : await resolver();
      if (!equipo) return null;
      await flushNominaPendiente(equipo, roster);
      return { id: equipo.id };
    },
    // Fuerza a guardar YA lo que esté tipeado/elegido, sin esperar los
    // 500ms de quietud — se llama justo antes de crear/retomar el partido
    // en "Juego en vivo", para cerrar cualquier ventana donde Mesa o el
    // marcador real pudieran quedar mostrando un nombre/color/logo viejo
    // por una carrera contra el guardado en segundo plano.
    async guardarAhora() {
      if (temporizadorGuardadoRef.current) clearTimeout(temporizadorGuardadoRef.current);
      await guardarEquipo();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [equipoId, nombre, color, logoUrl, roster]);

  return (
    <div className="tarjeta">
      <h3>{titulo}</h3>
      {error && <p className="mensaje-error">{error}</p>}

      <div className="fila-form" style={{ flexWrap: 'wrap' }}>
        <input
          value={nombre}
          onChange={(e) => cambiarNombre(e.target.value)}
          placeholder={valorDefecto}
          style={{ flex: 1, minWidth: 160 }}
        />
        <SelectorLogo logos={logos} value={logoUrl} onChange={(v) => { setLogoUrl(v); setLogoTocado(true); }} onLogoSubido={onLogoSubido} />
      </div>

      <SelectorColorEquipo color={color} onChange={setColor} />

      <label className="toggle-switch">
        <input type="checkbox" checked={nominaHabilitada} disabled={resolviendo} onChange={(e) => alternarNomina(e.target.checked)} />
        {resolviendo ? 'Preparando…' : 'Agregar nómina (número y nombre de cada jugador/a)'}
      </label>

      {nominaHabilitada && equipoId && (
        <>
          <EquipoRoster
            equipo={{ id: equipoId, nombre }}
            roster={roster}
            seleccionable={false}
            onJugadorAgregado={(j) => setRoster((r) => [...r, j])}
            onAgregarJugador={agregarJugadorLocal}
          />
          {roster.some((j) => j.pendiente) && (
            <div className="fila-form" style={{ marginTop: -12 }}>
              <span className="texto-tenue">
                Sin guardar todavía — se guarda sola al empezar "Juego en vivo", o guardala ahora si querés reusar este plantel más adelante.
              </span>
              <button type="button" className="btn-secundario btn-chico" disabled={guardandoNomina} onClick={guardarNominaPendiente}>
                {guardandoNomina ? 'Guardando…' : '💾 Guardar nómina ahora'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default EquipoFicha;
