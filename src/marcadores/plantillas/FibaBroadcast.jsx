import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

// Inspirada en el gráfico de marcador de las Clasificatorias a Copa del
// Mundo de FIBA: paneles de color con corte diagonal para cada equipo,
// puntajes grandes sobre fondo negro, y una franja inferior angosta con
// los tiempos muertos restantes (barritas) y las faltas de período — todo
// con datos reales del partido. El código corto de 3-4 letras (CHI, USA)
// es el campo `codigo` del equipo (opcional, se carga en "Equipos") — sin
// cargarlo, muestra el nombre completo como el resto de las plantillas.
export default function FibaBroadcast({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);
  const timeoutsLocal = partido.timeoutsLocal ?? 0;
  const timeoutsVisita = partido.timeoutsVisita ?? 0;

  return (
    <div className="plantilla-marcador pfb-wrap" style={estiloPersonalizado(config)}>
      <div className="pfb-caja">
        <div className="pfb-fila-principal">
          <div className="pfb-equipo pfb-local" style={{ background: partido.equipoLocal.color }}>
            <LogoEquipo equipo={partido.equipoLocal} config={config} className="pfb-logo" />
            <span className={`pfb-nombre ${partido.equipoLocal.codigo ? 'pfb-codigo' : ''}`}>{partido.equipoLocal.codigo || partido.equipoLocal.nombre}</span>
          </div>
          <span className={`pfb-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          <span className={`pfb-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          <div className="pfb-equipo pfb-visita" style={{ background: partido.equipoVisita.color }}>
            <span className={`pfb-nombre ${partido.equipoVisita.codigo ? 'pfb-codigo' : ''}`}>{partido.equipoVisita.codigo || partido.equipoVisita.nombre}</span>
            <LogoEquipo equipo={partido.equipoVisita} config={config} className="pfb-logo" />
          </div>
          <div className="pfb-info">
            <span className="pfb-periodo">{etiquetaPeriodo(partido.periodo)}</span>
            {mostrar(config, 'mostrarReloj') && <span className="pfb-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          </div>
        </div>
        {mostrar(config, 'mostrarFaltas') && (
          <div className="pfb-fila-secundaria">
            <div className="pfb-timeouts">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`pfb-to ${i < timeoutsLocal ? 'activo' : ''}`} style={{ '--color-to': partido.equipoLocal.color }} />
              ))}
            </div>
            <span className="pfb-faltas">FALTAS {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}-{indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>
            <div className="pfb-timeouts">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`pfb-to ${i < timeoutsVisita ? 'activo' : ''}`} style={{ '--color-to': partido.equipoVisita.color }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
