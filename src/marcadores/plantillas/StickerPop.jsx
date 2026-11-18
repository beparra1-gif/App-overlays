import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import { colorEquipo, faltasTexto, enBonus, tienePosesion } from './_comunNuevas';
import '../plantillas.css';
import '../plantillasNuevas.css';

// Sticker Pop: cada equipo es un "sticker" despegado (borde blanco grueso,
// sombra dura, apenas inclinado) y el reloj una cinta adhesiva amarilla.
// Pensado para ligas juveniles, 3x3 o transmisiones más descontracturadas.
function Sticker({ partido, config, lado }) {
  const equipo = lado === 'local' ? partido.equipoLocal : partido.equipoVisita;
  const pts = lado === 'local' ? partido.ptsLocal : partido.ptsVisita;
  const pulso = usePulso(pts);
  return (
    <div className={`nvk-sticker nvk-sticker-${lado}`} style={{ '--nv-equipo': colorEquipo(equipo, lado === 'local' ? '#ff3b30' : '#0a84ff') }}>
      <LogoEquipo equipo={equipo} config={config} className="nvk-logo" />
      <span className="nvk-nombre">
        {equipo.nombre}
        {mostrar(config, 'mostrarFaltas') && (
          <small className={enBonus(partido, lado) ? 'pm-bonus' : ''}>faltas {indicadorFaltas(faltasTexto(partido, lado), config?.estiloFaltas)}</small>
        )}
      </span>
      <span className={`nvk-pts ${pulso ? 'pm-pulso' : ''}`}>{pts}</span>
      {mostrar(config, 'mostrarPosesion') && tienePosesion(partido, lado) && <span className="nvk-posesion">🏀</span>}
    </div>
  );
}

export default function StickerPop({ partido, config }) {
  return (
    <div className="plantilla-marcador nvk-wrap" style={estiloPersonalizado(config)}>
      <div className="nvk-caja">
        <Sticker partido={partido} config={config} lado="local" />
        <div className="nvk-cinta">
          {mostrar(config, 'mostrarReloj') && <span className="nvk-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span className="nvk-periodo">{etiquetaPeriodo(partido.periodo)}</span>
        </div>
        <Sticker partido={partido} config={config} lado="visita" />
      </div>
    </div>
  );
}
