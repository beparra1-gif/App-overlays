import { usePatrocinadorActual } from './utils';

export default function PatrocinadorBanner({ patrocinadores, className }) {
  const patrocinador = usePatrocinadorActual(patrocinadores);
  if (!patrocinador) return null;
  return (
    <div className={className}>
      <img src={patrocinador.imagen_url} alt={patrocinador.nombre} />
    </div>
  );
}
