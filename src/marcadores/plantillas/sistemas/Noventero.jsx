import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, sigla, equipoDe, Reaccion, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 9 · Noventero — TV deportiva de los 90 con formas Memphis: píldoras
// inclinadas que rebotan, un garabato ondulado y "+N" que salta al anotar.
function Equipo({ partido, config, lado }) {
  return (
    <div className={`sxn-equipo sxn-${lado}`}>
      <Logo partido={partido} config={config} lado={lado} className="sxn-logo" />
      <span className="sxn-sigla">{sigla(equipoDe(partido, lado))}{posesion(partido, config, lado) ? '★' : ''}</span>
      <span className="sxn-pildora"><Pts partido={partido} lado={lado} /></span>
      <Faltas partido={partido} config={config} lado={lado} className="sxn-faltas" />
      <Reaccion partido={partido} lado={lado} className="sxn-reaccion" />
    </div>
  );
}
export default function Noventero({ partido, config }) {
  return (
    <div className="plantilla-marcador sxn-wrap" style={estiloPersonalizado(config)}>
      <div className="sxn-caja">
        <span className="sxn-forma sxn-triangulo" aria-hidden="true" />
        <span className="sxn-forma sxn-circulo" aria-hidden="true" />
        <Equipo partido={partido} config={config} lado="local" />
        <div className="sxn-centro">
          <span className="sxn-periodo">{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}
          <svg className="sxn-garabato" viewBox="0 0 120 14" aria-hidden="true"><path d="M0 7 Q7.5 0 15 7 T30 7 T45 7 T60 7 T75 7 T90 7 T105 7 T120 7" /></svg>
        </div>
        <Equipo partido={partido} config={config} lado="visita" />
      </div>
    </div>
  );
}
