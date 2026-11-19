import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, soloAdmin = false }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <div className="pagina-centrada">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && !usuario.es_admin) return <Navigate to="/disenos" replace />;
  // Un operador de Mesa solo ve la Mesa del partido en vivo.
  if (usuario.operador && !/^\/(en-vivo|mesa\/)/.test(location.pathname)) return <Navigate to="/en-vivo" replace />;
  return children;
}
