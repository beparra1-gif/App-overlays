import Clasico from './plantillas/Clasico';
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
];

export const obtenerPlantilla = (id) => PLANTILLAS_MARCADOR.find((p) => p.id === id) || PLANTILLAS_MARCADOR[0];
