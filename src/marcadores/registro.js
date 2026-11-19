import { idBasePlantilla } from './utils';
import Clasico from './plantillas/Clasico';
import './temasSistemas.css';
import './escalaBase.css';
import Crossover from './plantillas/sistemas/Crossover';
import FocoArena from './plantillas/sistemas/FocoArena';
import PizarraTactica from './plantillas/sistemas/PizarraTactica';
import TicketRecibo from './plantillas/sistemas/TicketRecibo';
import CromoColeccionable from './plantillas/sistemas/CromoColeccionable';
import Metro from './plantillas/sistemas/Metro';
import TableroPaletas from './plantillas/sistemas/TableroPaletas';
import AficheRiso from './plantillas/sistemas/AficheRiso';
import Noventero from './plantillas/sistemas/Noventero';
import PulsoPartido from './plantillas/sistemas/PulsoPartido';
import FotoProtagonista from './plantillas/sistemas/FotoProtagonista';
import GranTitular from './plantillas/sistemas/GranTitular';
import ApiladoReacciones from './plantillas/sistemas/ApiladoReacciones';
import Modular from './plantillas/sistemas/Modular';
import EscudoTorneo from './plantillas/sistemas/EscudoTorneo';
import AlasTrapecio from './plantillas/sistemas/AlasTrapecio';
import CartelRasgado from './plantillas/sistemas/CartelRasgado';
import BarraPro from './plantillas/sistemas/BarraPro';
import CapsulaMedallon from './plantillas/sistemas/CapsulaMedallon';
import BarraCadena from './plantillas/sistemas/BarraCadena';
import FranjaClasificatoria from './plantillas/sistemas/FranjaClasificatoria';

import Brutalista from './plantillas/Brutalista';
import Suizo from './plantillas/Suizo';
import TorreLateral from './plantillas/TorreLateral';
import Momentum from './plantillas/Momentum';
import MediaCancha from './plantillas/MediaCancha';
import StickerPop from './plantillas/StickerPop';
import Terminal from './plantillas/Terminal';

import Nba from './plantillas/Nba';
import Ncaa from './plantillas/Ncaa';
import Minimal from './plantillas/Minimal';
import Neon from './plantillas/Neon';
import Streetball from './plantillas/Streetball';
import Ticker from './plantillas/Ticker';
import CornerMinimo from './plantillas/CornerMinimo';
import Split from './plantillas/Split';
import Glass from './plantillas/Glass';
import ArenaGlow from './plantillas/ArenaGlow';
import ChampionshipGold from './plantillas/ChampionshipGold';
import EspnTicker from './plantillas/EspnTicker';
import SlantDynamic from './plantillas/SlantDynamic';
import RetroLed from './plantillas/RetroLed';
import CardStack from './plantillas/CardStack';
import GradientWave from './plantillas/GradientWave';
import OutlineBold from './plantillas/OutlineBold';
import CircleFocus from './plantillas/CircleFocus';
import LowerThird from './plantillas/LowerThird';
import EuroDivider from './plantillas/EuroDivider';
import BroadcastBonus from './plantillas/BroadcastBonus';
import CompactoTOFO from './plantillas/CompactoTOFO';
import RecordBlock from './plantillas/RecordBlock';
import PildoraDoble from './plantillas/PildoraDoble';
import Personalizado from './plantillas/Personalizado';
import FibaBroadcast from './plantillas/FibaBroadcast';
import HaloDigital from './plantillas/HaloDigital';
import DiarioDeportivo from './plantillas/DiarioDeportivo';
import AnilloCampeones from './plantillas/AnilloCampeones';
import TableroMadera from './plantillas/TableroMadera';
import HudTactico from './plantillas/HudTactico';
import CreadorLibre from './plantillas/CreadorLibre';

// Para agregar una plantilla nueva: crear el componente en ./plantillas
// (recibe `{ partido, config }`, aplica estiloPersonalizado(config) en su
// contenedor raíz y respeta mostrar(config, 'mostrarFaltas'/'mostrarPosesion'/
// 'mostrarLogo') donde corresponda), darle sus estilos en plantillas.css con
// un prefijo propio, y sumarla acá.
export const PLANTILLAS_MARCADOR = [
  { id: 'clasico', nombre: 'Clásico', Componente: Clasico },
  { id: 'nba', nombre: 'NBA League Pass', Componente: Nba },
  { id: 'ncaa', nombre: 'NCAA Corner Bug', Componente: Ncaa },
  { id: 'minimal', nombre: 'Minimalista', Componente: Minimal },
  { id: 'neon', nombre: 'Neón / Arcade', Componente: Neon },
  { id: 'street', nombre: 'Streetball', Componente: Streetball },
  { id: 'ticker', nombre: 'Ticker de transmisión', Componente: Ticker },
  { id: 'corner-min', nombre: 'Corner Bug mínimo', Componente: CornerMinimo },
  { id: 'split', nombre: 'Split por color', Componente: Split },
  { id: 'glass', nombre: 'Cristal (Glassmorphism)', Componente: Glass },
  { id: 'arena-glow', nombre: 'Arena Glow', Componente: ArenaGlow },
  { id: 'championship-gold', nombre: 'Championship Gold', Componente: ChampionshipGold },
  { id: 'espn-ticker', nombre: 'ESPN Ticker', Componente: EspnTicker },
  { id: 'slant-dynamic', nombre: 'Slant Dynamic', Componente: SlantDynamic },
  { id: 'retro-led', nombre: 'Retro LED', Componente: RetroLed },
  { id: 'card-stack', nombre: 'Card Stack', Componente: CardStack },
  { id: 'gradient-wave', nombre: 'Gradient Wave', Componente: GradientWave },
  { id: 'outline-bold', nombre: 'Outline Bold', Componente: OutlineBold },
  { id: 'circle-focus', nombre: 'Circle Focus', Componente: CircleFocus },
  { id: 'lower-third', nombre: 'Lower Third', Componente: LowerThird },
  { id: 'euro-divider', nombre: 'Euro Divisor', Componente: EuroDivider },
  { id: 'broadcast-bonus', nombre: 'Broadcast Bonus', Componente: BroadcastBonus },
  { id: 'compacto-tofo', nombre: 'Compacto TO/FO', Componente: CompactoTOFO },
  { id: 'record-block', nombre: 'Record Block', Componente: RecordBlock },
  { id: 'pildora-doble', nombre: 'Píldora Doble', Componente: PildoraDoble },
  { id: 'personalizado', nombre: 'Personalizado (armá el tuyo)', Componente: Personalizado },
  { id: 'fiba-broadcast', nombre: 'FIBA Broadcast', Componente: FibaBroadcast },
  { id: 'halo-digital', nombre: 'Halo Digital', Componente: HaloDigital },
  { id: 'diario-deportivo', nombre: 'Diario Deportivo', Componente: DiarioDeportivo },
  { id: 'anillo-campeones', nombre: 'Anillo de Campeones', Componente: AnilloCampeones },
  { id: 'tablero-madera', nombre: 'Tablero de Madera', Componente: TableroMadera },
  { id: 'hud-tactico', nombre: 'HUD Táctico', Componente: HudTactico },
  { id: 'brutalista', nombre: 'Brutalista', Componente: Brutalista, nuevo: true },
  { id: 'suizo', nombre: 'Suizo Tipográfico', Componente: Suizo, nuevo: true },
  { id: 'torre-lateral', nombre: 'Torre Lateral', Componente: TorreLateral, nuevo: true },
  { id: 'momentum', nombre: 'Momentum', Componente: Momentum, nuevo: true },
  { id: 'media-cancha', nombre: 'Media Cancha', Componente: MediaCancha, nuevo: true },
  { id: 'sticker-pop', nombre: 'Sticker Pop', Componente: StickerPop, nuevo: true },
  { id: 'terminal', nombre: 'Terminal', Componente: Terminal, nuevo: true },
  { id: 'crossover', nombre: 'Crossover', Componente: Crossover, nuevo: true, sistema: true },
  { id: 'foco-arena', nombre: 'Foco de Arena', Componente: FocoArena, nuevo: true, sistema: true },
  { id: 'pizarra-tactica', nombre: 'Pizarra Táctica', Componente: PizarraTactica, nuevo: true, sistema: true },
  { id: 'ticket-recibo', nombre: 'Ticket y Recibo', Componente: TicketRecibo, nuevo: true, sistema: true },
  { id: 'cromo-coleccionable', nombre: 'Cromo Coleccionable', Componente: CromoColeccionable, nuevo: true, sistema: true },
  { id: 'metro', nombre: 'Metro', Componente: Metro, nuevo: true, sistema: true },
  { id: 'tablero-paletas', nombre: 'Tablero de Paletas', Componente: TableroPaletas, nuevo: true, sistema: true },
  { id: 'afiche-riso', nombre: 'Afiche Riso', Componente: AficheRiso, nuevo: true, sistema: true },
  { id: 'noventero', nombre: 'Noventero', Componente: Noventero, nuevo: true, sistema: true },
  { id: 'pulso-partido', nombre: 'Pulso del Partido', Componente: PulsoPartido, nuevo: true, sistema: true },
  { id: 'foto-protagonista', nombre: 'Foto Protagonista', Componente: FotoProtagonista, nuevo: true, sistema: true },
  { id: 'gran-titular', nombre: 'Gran Titular', Componente: GranTitular, nuevo: true, sistema: true },
  { id: 'apilado-reacciones', nombre: 'Apilado y Reacciones', Componente: ApiladoReacciones, nuevo: true, sistema: true },
  { id: 'modular', nombre: 'Marcador Modular', Componente: Modular, nuevo: true, sistema: true },
  { id: 'escudo-torneo', nombre: 'Escudo del Torneo', Componente: EscudoTorneo, nuevo: true, sistema: true },
  { id: 'alas-trapecio', nombre: 'Alas en Trapecio', Componente: AlasTrapecio, nuevo: true, sistema: true },
  { id: 'cartel-rasgado', nombre: 'Cartel Rasgado', Componente: CartelRasgado, nuevo: true, sistema: true },
  { id: 'barra-pro', nombre: 'Barra Pro', Componente: BarraPro, nuevo: true, sistema: true },
  { id: 'capsula-medallon', nombre: 'Cápsula con Medallón', Componente: CapsulaMedallon, nuevo: true, sistema: true },
  { id: 'barra-cadena', nombre: 'Barra de Cadena TV', Componente: BarraCadena, nuevo: true, sistema: true },
  { id: 'franja-clasificatoria', nombre: 'Franja Clasificatoria', Componente: FranjaClasificatoria, nuevo: true, sistema: true },
  { id: 'creador-libre', nombre: '🎨 Creador Libre (armá el tuyo desde cero)', Componente: CreadorLibre },
];

// Una plantilla PERSONALIZADA guardada (ver plantillas_personalizadas en el
// backend) no vive como un componente de código — es una "receta" (config
// con creadorElementos) que un diseño usa con un plantilla_base sintético
// `custom-<id>`, para que cada una tenga su propia fila en disenos_guardados
// (1 por plantilla_base) sin pisarse entre sí ni con el "Creador Libre" en
// blanco. Acá se resuelve ese id sintético al MISMO componente que
// "Creador Libre" — el que realmente dibuja es el config (los elementos),
// no el componente, así que cualquier `custom-*` cae bien.
export const obtenerPlantilla = (idCompleto) => {
  const id = idBasePlantilla(idCompleto);
  if (typeof id === 'string' && id.startsWith('custom-')) {
    return PLANTILLAS_MARCADOR.find((p) => p.id === 'creador-libre');
  }
  return PLANTILLAS_MARCADOR.find((p) => p.id === id) || PLANTILLAS_MARCADOR[0];
};
