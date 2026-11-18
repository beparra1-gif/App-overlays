import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Logo, sigla, equipoDe, colorDe, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 17 · Cartel rasgado — afiche callejero: papel con bordes rotos, textura
// de spray y tipografía gastada enorme; cada equipo es un trozo pegado.
export default function CartelRasgado({ partido, config }) {
  return (
    <div className="plantilla-marcador sxz-wrap" style={estiloPersonalizado(config)}>
      <div className="sxz-caja">
        {['local', 'visita'].map((lado) => (
          <div key={lado} className={`sxz-trozo sxz-${lado}`} style={{ '--sx-equipo': colorDe(partido, lado) }}>
            <span className="sxz-sigla"><Logo partido={partido} config={config} lado={lado} className="sxz-logo" />{sigla(equipoDe(partido, lado))}{posesion(partido, config, lado) ? '*' : ''}</span>
            <Pts partido={partido} lado={lado} className="sxz-pts" />
            <Faltas partido={partido} config={config} lado={lado} className="sxz-faltas" />
          </div>
        ))}
        <div className="sxz-cinta">
          {etiquetaPeriodo(partido.periodo)}{mostrar(config, 'mostrarReloj') ? ` / ${formatearReloj(partido.relojSegundos)}` : ''}
        </div>
      </div>
    </div>
  );
}
