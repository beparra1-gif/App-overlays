import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

export default function Clasico({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);
  // 'dentro' (de siempre, sin nada elegido): el nombre vive acá adentro,
  // apilado con el logo/puntaje. Cualquier otro valor saca el nombre de
  // ADENTRO de la caja — lo muestra NombreFlotante (ver VistaMarcador.jsx),
  // anclado a la caja real en vez de apilado — para no duplicarlo.
  const nombreFlotante = config?.clasicoNombrePosicion && config.clasicoNombrePosicion !== 'dentro';

  return (
    <div className="plantilla-marcador pc-wrap" style={estiloPersonalizado(config)}>
      <div className="pc-caja">
        <div className="pc-equipo">
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pc-logo" />
          {!nombreFlotante && <span className="pc-nombre" style={{ color: partido.equipoLocal.color }}>{partido.equipoLocal.nombre}</span>}
          <span className={`pc-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          {mostrar(config, 'mostrarFaltas') && <span className={`pc-faltas ${partido.bonusLocal ? 'pm-bonus' : ''}`}>F {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}{partido.bonusLocal ? ' BONUS' : ''}</span>}
        </div>
        <div className="pc-centro">
          {mostrar(config, 'mostrarReloj') && <span className="pc-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span className="pc-periodo">{etiquetaPeriodo(partido.periodo)}</span>
        </div>
        <div className="pc-equipo">
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pc-logo" />
          {!nombreFlotante && <span className="pc-nombre" style={{ color: partido.equipoVisita.color }}>{partido.equipoVisita.nombre}</span>}
          <span className={`pc-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          {mostrar(config, 'mostrarFaltas') && <span className={`pc-faltas ${partido.bonusVisita ? 'pm-bonus' : ''}`}>F {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}{partido.bonusVisita ? ' BONUS' : ''}</span>}
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pc-patrocinador" />
    </div>
  );
}
