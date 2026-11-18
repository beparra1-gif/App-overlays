import { formatearReloj, etiquetaPeriodo, estiloPersonalizado, mostrar } from '../../utils';
import { Pts, Faltas, Medallon, Reaccion, posesion } from './comun';
import '../../plantillas.css';
import '../../plantillasSistemas.css';

// 13 · Apilado y reacciones — medallones del mismo tamaño y una "reacción"
// (+2, +3) que salta del lado del equipo cada vez que anota.
export default function ApiladoReacciones({ partido, config }) {
  return (
    <div className="plantilla-marcador sxy-wrap" style={estiloPersonalizado(config)}>
      <div className="sxy-caja">
        {['local', 'visita'].map((lado, i) => (
          <div key={lado} className={`sxy-lado sxy-${lado}`} style={{ order: i * 2 }}>
            <Medallon partido={partido} config={config} lado={lado} className="sxy-medallon" />
            <Pts partido={partido} lado={lado} className="sxy-pts" />
            <Faltas partido={partido} config={config} lado={lado} className="sxy-faltas" prefijo="" />
            {posesion(partido, config, lado) && <span className="sxy-pos" />}
            <Reaccion partido={partido} lado={lado} className="sxy-reaccion" />
          </div>
        ))}
        <div className="sxy-centro" style={{ order: 1 }}>
          <span>{etiquetaPeriodo(partido.periodo)}</span>
          {mostrar(config, 'mostrarReloj') && <b>{formatearReloj(partido.relojSegundos)}</b>}
        </div>
      </div>
    </div>
  );
}
