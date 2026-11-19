import { formatearReloj, estiloPersonalizado, mostrar, contrasteTexto } from '../../utils';
import { Pts, sigla, equipoDe, colorDe, posesion, faltasDe, bonusDe, Posesion24, logoCompetencia, tituloAdentro } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// Faltas de equipo como 5 rayas encendidas del color del equipo (BONUS: todas).
function RayasFaltas({ partido, config, lado }) {
  const estilo = { '--sx-equipo': colorDe(partido, lado) };
  if (!mostrar(config, 'mostrarFaltas')) return <span className="frm-rayas" />;
  const n = bonusDe(partido, lado) ? 5 : Math.min(5, faltasDe(partido, lado));
  return (
    <span className="frm-rayas" style={estilo} aria-label={`${faltasDe(partido, lado)} faltas`}>
      {Array.from({ length: 5 }).map((_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </span>
  );
}

// 21 · Franja clasificatoria — barra larga de torneo: a la izquierda el logo
// y el nombre de la competencia (el título: "Competencia — Fecha 7 — #etiqueta"),
// cada equipo en un bloque de su color cortado en diagonal, los puntajes al
// centro y período/reloj/24" a la derecha. Abajo, las faltas como rayas.
export default function FranjaClasificatoria({ partido, config }) {
  const [competencia, fecha, etiqueta] = (tituloAdentro(config) || '').split(/\s+[—|-]\s+/);
  const escudo = logoCompetencia(config);
  const equipo = (lado) => {
    const color = colorDe(partido, lado);
    return (
      <span className={`frm-equipo frm-${lado}`} style={{ '--sx-equipo': color, color: contrasteTexto(color) }}>
        {lado === 'visita' && posesion(partido, config, lado) && <i className="frm-pos" aria-label="posesión" />}
        <span className="frm-sigla">{sigla(equipoDe(partido, lado))}</span>
        {lado === 'local' && posesion(partido, config, lado) && <i className="frm-pos" aria-label="posesión" />}
      </span>
    );
  };
  return (
    <div className="plantilla-marcador frm-wrap" style={estiloPersonalizado(config)}>
      <div className="frm-caja">
        <div className="frm-fila">
          <span className="frm-comp">
            {escudo && <img src={escudo} alt="" />}
            <span className="frm-comp-nombre">{competencia || 'EN VIVO'}</span>
          </span>
          {equipo('local')}
          <Pts partido={partido} lado="local" className="frm-pts" />
          <Pts partido={partido} lado="visita" className="frm-pts" />
          {equipo('visita')}
          <span className="frm-periodo" data-pm-paleta>{partido.periodo <= 4 ? `${partido.periodo}°` : `OT${partido.periodo - 4}`}</span>
          <span className="frm-reloj">{mostrar(config, 'mostrarReloj') ? formatearReloj(partido.relojSegundos) : ''}</span>
          <Posesion24 partido={partido} config={config} className="frm-24" />
        </div>
        <div className="frm-pie">
          <span className="frm-fecha">{fecha || ''}</span>
          <RayasFaltas partido={partido} config={config} lado="local" />
          <RayasFaltas partido={partido} config={config} lado="visita" />
          <span className="frm-etiqueta">{etiqueta || ''}</span>
        </div>
      </div>
    </div>
  );
}
