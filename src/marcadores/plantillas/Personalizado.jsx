import { formatearReloj, etiquetaPeriodo, usePulso, estiloPersonalizado, mostrar, indicadorFaltas } from '../utils';
import PatrocinadorBanner from '../PatrocinadorBanner';
import LogoEquipo from '../LogoEquipo';
import '../plantillas.css';

// "Personalizado": en vez de una plantilla más con su propio look fijo, es
// la respuesta al pedido de un editor de plantillas nuevas — un lienzo en
// blanco (mismo layout probado de Clásico: logo/nombre/puntos/faltas por
// lado, reloj y período al centro) donde la FORMA de la caja y el BORDE se
// eligen desde Personalizar diseño → Marcador → Forma, en vez de venir fijos
// en el CSS. Combinado con todo lo que ya es configurable para cualquier
// plantilla (colores, fuente, tamaños, posición libre, logo, faltas,
// animación de puntos...), da un rango real de looks distintos sin que haga
// falta programar una plantilla nueva por cada combinación.
const RADIO_POR_FORMA = { redondeada: 16, cuadrada: 4, pildora: 999 };

const ESTILO_POR_BORDE = {
  ninguno: { border: 'none' },
  fino: { border: '2px solid var(--pm-banner, rgba(255, 255, 255, 0.15))' },
  grueso: { border: '5px solid var(--pm-banner, rgba(255, 255, 255, 0.28))' },
  glow: {
    border: '2px solid var(--pm-banner, rgba(255, 255, 255, 0.2))',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--pm-banner, #ffd60a) 35%, transparent), 0 20px 50px rgba(0, 0, 0, 0.5)',
  },
};

export default function Personalizado({ partido, config }) {
  const pulsoLocal = usePulso(partido.ptsLocal);
  const pulsoVisita = usePulso(partido.ptsVisita);
  const forma = config?.personalizadoForma || 'redondeada';
  const borde = config?.personalizadoBorde || 'fino';
  const estiloCaja = { borderRadius: RADIO_POR_FORMA[forma] ?? 16, ...(ESTILO_POR_BORDE[borde] || ESTILO_POR_BORDE.fino) };

  return (
    <div className="plantilla-marcador pz-wrap" style={estiloPersonalizado(config)}>
      <div className="pz-caja" style={estiloCaja}>
        <div className="pz-equipo">
          <LogoEquipo equipo={partido.equipoLocal} config={config} className="pz-logo" />
          <span className="pz-nombre" style={{ color: partido.equipoLocal.color }}>{partido.equipoLocal.nombre}</span>
          <span className={`pz-pts ${pulsoLocal ? 'pm-pulso' : ''}`}>{partido.ptsLocal}</span>
          {mostrar(config, 'mostrarFaltas') && <span className="pz-faltas">F {indicadorFaltas(partido.faltasPeriodoLocal, config?.estiloFaltas)}</span>}
        </div>
        <div className="pz-centro">
          {mostrar(config, 'mostrarReloj') && <span className="pz-reloj">{formatearReloj(partido.relojSegundos)}</span>}
          <span className="pz-periodo">{etiquetaPeriodo(partido.periodo)}</span>
        </div>
        <div className="pz-equipo">
          <LogoEquipo equipo={partido.equipoVisita} config={config} className="pz-logo" />
          <span className="pz-nombre" style={{ color: partido.equipoVisita.color }}>{partido.equipoVisita.nombre}</span>
          <span className={`pz-pts ${pulsoVisita ? 'pm-pulso' : ''}`}>{partido.ptsVisita}</span>
          {mostrar(config, 'mostrarFaltas') && <span className="pz-faltas">F {indicadorFaltas(partido.faltasPeriodoVisita, config?.estiloFaltas)}</span>}
        </div>
      </div>
      <PatrocinadorBanner patrocinadores={partido.patrocinadores} className="pz-patrocinador" />
    </div>
  );
}
