import { estiloTema, fuenteDePlantilla } from './utils';
import './titulo.css';

// Encabezado opcional del marcador — capa compuesta (mismo truco de apilado
// que LogoFlotante/PopSumaPuntos: hermano position:fixed, sin tocar ninguna
// de las 25 plantillas), pegada justo arriba de la caja. Apagada por
// defecto: solo aparece si el usuario activa "Mostrar título" y escribe un
// texto en Personalizar diseño.
//
// `caja` (si llega, ver useCajaMarcador) es la medida REAL de la caja ya
// renderizada — se usa en vez de estiloAnclaTitulo (una aproximación única
// para las 25 plantillas) para que el título quede pegado justo donde
// termina la caja de VERDAD, sin superponerse con el reloj en las
// plantillas más altas que el promedio. Mientras no haya medida todavía
// (primer render) no se dibuja nada — mejor no mostrarlo un instante que
// mostrarlo mal ubicado y que se "salte" a su lugar correcto después.
// `suprimir`: modo "reemplaza el título" de Anuncios (config.anunciosTituloModo)
// — mientras hay un aviso de jugada en pantalla, el título se apaga del
// todo y el aviso ocupa ese mismo lugar, en vez de mostrar los dos juntos.
export default function TituloMarcador({ config, plantillaId, caja, suprimir = false }) {
  const texto = (config?.tituloTexto || '').trim();
  if (!config?.mostrarTitulo || !texto || !caja || suprimir) return null;
  const estilo = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    pointerEvents: 'none',
    ...estiloTema(config),
    '--pm-fuente': fuenteDePlantilla(plantillaId),
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: `${caja.left + caja.width / 2}%`,
    paddingTop: `${caja.top}%`,
  };
  return (
    <div style={estilo}>
      <div className="pm-titulo-ancla">
        <div className="pm-titulo-texto">{texto}</div>
      </div>
    </div>
  );
}
