import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return <div className="pagina-centrada">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}
