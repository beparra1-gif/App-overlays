import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, sigla, equipoDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 4 · Ticket y recibo — una entrada de estadio perforada: el talón lleva
// reloj y cuarto con tipografía de máquina, y un sello cuando hay bonus.
function Equipo({ partido, config, lado }) {
  return (
    <div className="sxt-equipo">
      <Logo partido={partido} config={config} lado={lado} className="sxt-logo" />
      <span className="sxt-sigla">{sigla(equipoDe(partido, lado))}{posesion(partido, config, lado) ? ' ●' : ''}</span>
      <Pts partido={partido} lado={lado} className="sxt-pts" />
      <Faltas partido={partido} config={config} lado={lado} className="sxt-faltas" prefijo="FLT" />
    </div>
  );
}
export default function TicketRecibo({ partido, config }) {
  return (
    <div className="plantilla-marcador sxt-wrap" style={estiloPersonalizado(config)}>
      <div className="sxt-caja">
        <Equipo partido={partido} config={config} lado="local" />
        <span className="sxt-guion" aria-hidden="true" />
        <Equipo partido={partido} config={config} lado="visita" />
        <div className="sxt-talon">
          <span>ADMIT ONE · {etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}
          <span className="sxt-serie">N° {String(partido.id || 0).padStart(6, '0')}</span>
        </div>
      </div>
    </div>
  );
}
