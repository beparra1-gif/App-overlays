import { formatearReloj, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, equipoDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

const PALABRA = ['', 'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO'];

// 12 · Gran titular — tipografía cinética: el cuarto escrito en una
// palabra gigante vertical que barre al cambiar; los equipos en franjas
// inclinadas al lado.
export default function GranTitular({ partido, config }) {
  const palabra = partido.periodo <= 4 ? PALABRA[partido.periodo] : 'PRÓRROGA';
  return (
    <div className="plantilla-marcador sxg-wrap" style={estiloPersonalizado(config)}>
      <div className="sxg-caja">
        <span className="sxg-palabra" key={palabra}>{palabra}</span>
        <div className="sxg-franjas">
          {['local', 'visita'].map((lado) => (
            <div key={lado} className="sxg-franja">
              <Logo partido={partido} config={config} lado={lado} className="sxg-logo" />
              <span className="sxg-nombre">{equipoDe(partido, lado).nombre}{posesion(partido, config, lado) ? ' •' : ''}</span>
              <Faltas partido={partido} config={config} lado={lado} className="sxg-faltas" />
              <Pts partido={partido} lado={lado} className="sxg-pts" />
            </div>
          ))}
          {mostrar(config, 'mostrarReloj') && <span className="sxg-reloj">{formatearReloj(partido.relojSegundos)}</span>}
        </div>
      </div>
    </div>
  );
}
