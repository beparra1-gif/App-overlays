import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

// Inspirada en el marcador mecánico de un gimnasio viejo: gabinete de
// madera con bisel grueso y dígitos tipo "flip" (cada número en su propia
// ficha, con la línea horizontal de la bisagra) — la única de las 28 con
// un gabinete físico de verdad en vez de un panel plano.
const digitos = (numero) => String(Math.max(0, Number(numero) || 0)).padStart(2, '0').split('');

export default function TableroMadera({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);

  return (
    <div className="plantilla-marcador ptm-wrap" style={estiloPersonalizado(config)}>
      <div className="ptm-caja">
        <div className="ptm-equipo">
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="ptm-logo" />
          <span className="ptm-nombre">{partido.equipoLocal.nombre}</span>
          <div className={`ptm-marcador-digital ${pulsoLocal ? 'pm-pulso' : ''}`}>
            {digitos(partido.ptsLocal).map((d, i) => <span key={i} className="ptm-digito">{d}</span>)}
          </div>
          {mostrar(config, 'mostrarFaltas') && <span className="ptm-faltas">FALTAS {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</span>}
        </div>
        <div className="ptm-centro">
          <span className="ptm-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <span className="ptm-reloj">{formatearReloj(partido.relojSegundos)}</span>}
        </div>
        <div className="ptm-equipo">
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="ptm-logo" />
          <span className="ptm-nombre">{partido.equipoVisita.nombre}</span>
          <div className={`ptm-marcador-digital ${pulsoVisita ? 'pm-pulso' : ''}`}>
            {digitos(partido.ptsVisita).map((d, i) => <span key={i} className="ptm-digito">{d}</span>)}
          </div>
          {mostrar(config, 'mostrarFaltas') && <span className="ptm-faltas">FALTAS {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>}
        </div>
      </div>
    </div>
  );
}
