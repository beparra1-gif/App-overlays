import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

// Acceso directo del menú "En vivo": abre la Mesa de control del partido que
// está en curso (el último que se tocó). Sin partido en curso, explica
// cómo empezar uno.
export default function EnVivo() {
  const navigate = useNavigate();
  const [sinPartido, setSinPartido] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.obtenerPartidoActivo()
      .then(({ partido }) => navigate(`/mesa/${partido.id}`, { replace: true }))
      .catch((err) => (err.status === 404 || /ningún partido/i.test(err.message) ? setSinPartido(true) : setError(err.message)));
  }, [navigate]);

  if (error) return <div className="pagina"><p className="mensaje-error">{error}</p></div>;
  if (!sinPartido) return <div className="pagina texto-tenue">Buscando el partido en curso…</div>;
  return (
    <div className="pagina">
      <div className="tarjeta" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center', padding: 28 }}>
        <h1 style={{ marginTop: 0 }}>🔴 No hay ningún partido en curso</h1>
        <p className="texto-tenue">Para jugar en vivo, abrí un diseño, elegí los equipos y empezá el partido desde la pestaña "Juego en vivo".</p>
        <div className="fila-form" style={{ justifyContent: 'center', margin: 0 }}>
          <Link className="btn-primario" to="/disenos">Ir a Diseños</Link>
          <Link className="btn-secundario" to="/partidos">Ver partidos anteriores</Link>
        </div>
      </div>
    </div>
  );
}
