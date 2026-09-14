import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

// Inspirada en una medalla/anillo de campeonato: medallón circular con
// borde dorado giratorio y un listón (ribbon, con la punta recortada en
// V) colgando debajo con el reloj/período — distinta de "Championship
// Gold" (esa es una caja horizontal con tipografía elegante) y de "Halo
// Digital" (esa es un HUD futurista) aunque las tres usen dorado/círculos
// por separado.
export default function AnilloCampeones({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador pac-wrap" style={estiloPersonalizado(config)}>
      <div className="pac-medallon">
        <div className="pac-aro-externo" />
        <div className="pac-contenido">
          <div className="pac-fila-equipos">
            <div className="pac-equipo">
              <LogoEquipo equipo={partido.equipoLocal} config={config} className="pac-logo" />
              <span className={`pac-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
            </div>
            <span className="pac-vs">VS</span>
            <div className="pac-equipo">
              <LogoEquipo equipo={partido.equipoVisita} config={config} className="pac-logo" />
              <span className={`pac-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
            </div>
          </div>
          <div className="pac-nombres">
            <span style={{ color: partido.equipoLocal.color }}>{partido.equipoLocal.nombre}</span>
            <span style={{ color: partido.equipoVisita.color }}>{partido.equipoVisita.nombre}</span>
          </div>
        </div>
      </div>
      <div className="pac-liston">
        {mostrar(config, 'mostrarReloj') && <span className="pac-reloj">{formatearReloj(partido.relojSegundos)}</span>}
        <span className="pac-periodo">{etiquetaPeriodo(partido.periodo)}</span>
        {mostrar(config, 'mostrarFaltas') && (
          <span className="pac-faltas">F {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}-{indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>
        )}
      </div>
    </div>
  );
}
