import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .me()
      .then((datos) => setUsuario(datos.usuario))
      .catch(() => setToken(null))
      .finally(() => setCargando(false));
  }, []);

  // Las 4 formas de terminar con una sesión iniciada (login, registro,
  // Google, reset de contraseña) devuelven la misma forma { token, usuario }
  // — todas pasan por acá para no repetir el guardado en 4 lados.
  const establecerSesion = (datos) => {
    setToken(datos.token);
    setUsuario(datos.usuario);
  };

  const login = async (email, password) => establecerSesion(await api.login({ email, password }));
  const registro = async (email, password, nombre) => establecerSesion(await api.registro({ email, password, nombre }));
  const loginGoogle = async (credential) => establecerSesion(await api.loginGoogle(credential));
  const resetearPassword = async (token, password) => establecerSesion(await api.resetearPassword(token, password));

  // Editar el perfil no devuelve un token nuevo (la sesión sigue siendo la
  // misma) — solo hace falta refrescar los datos del usuario ya logueado.
  const actualizarPerfil = async (payload) => {
    const { usuario: actualizado } = await api.actualizarPerfil(payload);
    setUsuario(actualizado);
    return actualizado;
  };

  const logout = () => {
    setToken(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registro, loginGoogle, resetearPassword, actualizarPerfil, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}
