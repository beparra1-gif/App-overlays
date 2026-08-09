import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Registro from './pages/Registro';
import OlvidePassword from './pages/OlvidePassword';
import ResetearPassword from './pages/ResetearPassword';
import Equipos from './pages/Equipos';
import Disenos from './pages/Disenos';
import Partidos from './pages/Partidos';
import Mesa from './pages/Mesa';
import MesaSimple from './pages/MesaSimple';
import EscenaPublica from './pages/EscenaPublica';
import Publicidad from './pages/Publicidad';
import Logos from './pages/Logos';
import Admin from './pages/Admin';
import Perfil from './pages/Perfil';

// Carga aparte (no en el bundle principal): trae tesseract.js, que nadie
// más que quien use el lector de reloj por cámara necesita descargar.
const LectorReloj = lazy(() => import('./pages/LectorReloj'));

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Routes>
          <Route path="/escena/:token" element={<EscenaPublica />} />

          <Route
            path="*"
            element={
              <>
                <NavBar />
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/registro" element={<Registro />} />
                  <Route path="/olvide-password" element={<OlvidePassword />} />
                  <Route path="/resetear-password" element={<ResetearPassword />} />
                  <Route path="/equipos" element={<ProtectedRoute><Equipos /></ProtectedRoute>} />
                  <Route path="/disenos" element={<ProtectedRoute><Disenos /></ProtectedRoute>} />
                  <Route path="/partidos" element={<ProtectedRoute><Partidos /></ProtectedRoute>} />
                  <Route path="/mesa/:id" element={<ProtectedRoute><Mesa /></ProtectedRoute>} />
                  <Route path="/mesa/:id/simple" element={<ProtectedRoute><MesaSimple /></ProtectedRoute>} />
                  <Route path="/mesa/:id/reloj-camara" element={<ProtectedRoute><Suspense fallback={<div className="pagina">Cargando…</div>}><LectorReloj /></Suspense></ProtectedRoute>} />
                  <Route path="/publicidad" element={<ProtectedRoute><Publicidad /></ProtectedRoute>} />
                  <Route path="/logos" element={<ProtectedRoute><Logos /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute soloAdmin><Admin /></ProtectedRoute>} />
                  <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
                  <Route path="/" element={<Navigate to="/disenos" replace />} />
                  <Route path="*" element={<Navigate to="/disenos" replace />} />
                </Routes>
              </>
            }
          />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}
