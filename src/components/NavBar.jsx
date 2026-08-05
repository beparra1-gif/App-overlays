import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function NavBar() {
  const { usuario, logout } = useAuth();
  const { tema, alternarTema } = useTheme();
  if (!usuario) return null;

  return (
    <nav className="navbar">
      <span className="navbar-marca">App-overlays</span>
      <NavLink to="/disenos" className="navbar-link">Diseños</NavLink>
      <NavLink to="/partidos" className="navbar-link">Partidos</NavLink>
      <NavLink to="/equipos" className="navbar-link">Equipos</NavLink>
      <NavLink to="/logos" className="navbar-link">Logos</NavLink>
      <NavLink to="/publicidad" className="navbar-link">Publicidad</NavLink>
      {usuario.es_admin && <NavLink to="/admin" className="navbar-link">🛡️ Admin</NavLink>}
      <NavLink to="/perfil" className="navbar-link navbar-link-perfil">👤 Perfil</NavLink>
      <span className="navbar-spacer" />
      <button className="btn-secundario" onClick={alternarTema} title="Cambiar tema">
        {tema === 'oscuro' ? '☀️ Claro' : '🌙 Oscuro'}
      </button>
      <NavLink to="/perfil" className="navbar-usuario navbar-usuario-link" title="Mi perfil">{usuario.nombre || usuario.email}</NavLink>
      <button className="btn-secundario" onClick={logout}>Salir</button>
    </nav>
  );
}
