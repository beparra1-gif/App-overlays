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
import EscenaPublica from './pages/EscenaPublica';

// Carga aparte (no en el bundle principal): trae tesseract.js, que nadie
// más que quien use el lector de reloj por cámara necesita descargar.
const LectorMarcador = lazy(() => import('./pages/LectorMarcador'));

// Páginas de gestión en chunks aparte: la escena pública (la que abre OBS
// en cada fuente de navegador) ya no descarga el diseñador, la Mesa, etc.
const Equipos = lazy(() => import('./pages/Equipos'));
const Disenos = lazy(() => import('./pages/Disenos'));
const Partidos = lazy(() => import('./pages/Partidos'));
const Temporadas = lazy(() => import('./pages/Temporadas'));
const Mesa = lazy(() => import('./pages/Mesa'));
const EnVivo = lazy(() => import('./pages/EnVivo'));
const Operador = lazy(() => import('./pages/Operador'));
const MesaSimple = lazy(() => import('./pages/MesaSimple'));
const Publicidad = lazy(() => import('./pages/Publicidad'));
const Logos = lazy(() => import('./pages/Logos'));
const Admin = lazy(() => import('./pages/Admin'));
const Perfil = lazy(() => import('./pages/Perfil'));

// El lector de reloj viejo (pedía iniciar sesión en el celular y solo leía
// el reloj) se reemplazó por el lector de marcador con QR: se abre desde la
// Mesa → 📷 Marcador. Los enlaces viejos guardados muestran cómo seguir.
function LectorReemplazado() {
  return (
    <div className="pagina">
      <h1>📷 El lector de reloj cambió</h1>
      <p className="texto-tenue">
        Ahora se usa el <strong>lector de marcador con QR</strong>: lee reloj, puntos, cuarto, faltas y posesión, y no
        pide iniciar sesión en el celular. En la Mesa de control tocá <strong>📷 Marcador</strong>, activá "Por cámara"
        y escaneá el código QR con el celular que va a filmar el marcador.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Routes>
          <Route path="/escena/:token" element={<EscenaPublica />} />
          {/* Lector de marcador por cámara: enlace/QR con token de alcance
              limitado, sin login (ver POST /partidos/:id/enlace-lector). */}
          <Route path="/lector/:token" element={<Suspense fallback={<div className="pagina">Cargando…</div>}><LectorMarcador /></Suspense>} />

          <Route
            path="*"
            element={
              <>
                <NavBar />
                <Suspense fallback={<div className="pagina texto-tenue">Cargando…</div>}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/registro" element={<Registro />} />
                  <Route path="/olvide-password" element={<OlvidePassword />} />
                  <Route path="/resetear-password" element={<ResetearPassword />} />
                  <Route path="/equipos" element={<ProtectedRoute><Equipos /></ProtectedRoute>} />
                  <Route path="/disenos" element={<ProtectedRoute><Disenos /></ProtectedRoute>} />
                  <Route path="/partidos" element={<ProtectedRoute><Partidos /></ProtectedRoute>} />
                  <Route path="/temporadas" element={<ProtectedRoute><Temporadas /></ProtectedRoute>} />
                  <Route path="/en-vivo" element={<ProtectedRoute><EnVivo /></ProtectedRoute>} />
                  <Route path="/operador" element={<Operador />} />
                  <Route path="/mesa/:id" element={<ProtectedRoute><Mesa /></ProtectedRoute>} />
                  <Route path="/mesa/:id/simple" element={<ProtectedRoute><MesaSimple /></ProtectedRoute>} />
                  {/* Enlace fijo por usuario (sin id de partido) — se resuelve solo al
                      partido "en_curso" más reciente, así sirve siempre con
                      cualquier marcador que el usuario tenga abierto, sin tener
                      que copiar un enlace nuevo cada vez que arranca otro juego. */}
                  <Route path="/mesa/reloj-camara" element={<LectorReemplazado />} />
                  <Route path="/mesa/:id/reloj-camara" element={<LectorReemplazado />} />
                  <Route path="/publicidad" element={<ProtectedRoute><Publicidad /></ProtectedRoute>} />
                  <Route path="/logos" element={<ProtectedRoute><Logos /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute soloAdmin><Admin /></ProtectedRoute>} />
                  <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
                  <Route path="/" element={<Navigate to="/disenos" replace />} />
                  <Route path="*" element={<Navigate to="/disenos" replace />} />
                </Routes>
                </Suspense>
              </>
            }
          />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}
