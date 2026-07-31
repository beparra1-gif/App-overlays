const resolveApiBaseUrl = () => {
  const envUrl = String(import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:3000/api';
  }
  return '/api';
};

export const API_BASE_URL = resolveApiBaseUrl();

const TOKEN_KEY = 'app_overlays_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

async function solicitud(path, { method = 'GET', body, autenticado = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (autenticado) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const respuesta = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (respuesta.status === 204) return null;

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(datos?.error || `Error ${respuesta.status}`);
  }
  return datos;
}

export const urlLogo = (filename) => `${API_BASE_URL}/logos/file/${filename}`;

async function subirArchivo(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const respuesta = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos?.error || `Error ${respuesta.status}`);
  return datos;
}

export const api = {
  registro: (payload) => solicitud('/auth/registro', { method: 'POST', body: payload, autenticado: false }),
  login: (payload) => solicitud('/auth/login', { method: 'POST', body: payload, autenticado: false }),
  loginGoogle: (credential) => solicitud('/auth/google', { method: 'POST', body: { credential }, autenticado: false }),
  olvidePassword: (email) => solicitud('/auth/olvide-password', { method: 'POST', body: { email }, autenticado: false }),
  resetearPassword: (token, password) => solicitud('/auth/resetear-password', { method: 'POST', body: { token, password }, autenticado: false }),
  me: () => solicitud('/auth/me'),
  actualizarPerfil: (payload) => solicitud('/auth/perfil', { method: 'PUT', body: payload }),
  cambiarPassword: (payload) => solicitud('/auth/password', { method: 'PUT', body: payload }),

  listarEquipos: () => solicitud('/equipos'),
  crearEquipo: (payload) => solicitud('/equipos', { method: 'POST', body: payload }),
  actualizarEquipo: (id, payload) => solicitud(`/equipos/${id}`, { method: 'PUT', body: payload }),
  eliminarEquipo: (id) => solicitud(`/equipos/${id}`, { method: 'DELETE' }),
  listarJugadores: (equipoId) => solicitud(`/equipos/${equipoId}/jugadores`),
  crearJugador: (equipoId, payload) => solicitud(`/equipos/${equipoId}/jugadores`, { method: 'POST', body: payload }),
  actualizarJugador: (id, payload) => solicitud(`/jugadores/${id}`, { method: 'PUT', body: payload }),
  eliminarJugador: (id) => solicitud(`/jugadores/${id}`, { method: 'DELETE' }),

  listarPartidos: () => solicitud('/partidos'),
  crearPartido: (payload) => solicitud('/partidos', { method: 'POST', body: payload }),
  obtenerPartido: (id) => solicitud(`/partidos/${id}`),
  actualizarQuintetos: (id, payload) => solicitud(`/partidos/${id}/quintetos`, { method: 'PUT', body: payload }),
  eliminarPartido: (id) => solicitud(`/partidos/${id}`, { method: 'DELETE' }),

  obtenerMarcadorPublico: (token) => solicitud(`/public/partidos/${token}`, { autenticado: false }),

  listarPatrocinadores: () => solicitud('/patrocinadores'),
  crearPatrocinador: (payload) => solicitud('/patrocinadores', { method: 'POST', body: payload }),
  actualizarPatrocinador: (id, payload) => solicitud(`/patrocinadores/${id}`, { method: 'PUT', body: payload }),
  eliminarPatrocinador: (id) => solicitud(`/patrocinadores/${id}`, { method: 'DELETE' }),

  listarLogos: () => solicitud('/logos'),
  subirLogo: (archivo, nombre) => {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('nombre', nombre || archivo.name);
    return subirArchivo('/logos', formData);
  },
  actualizarLogo: (id, payload) => solicitud(`/logos/${id}`, { method: 'PUT', body: payload }),
  eliminarLogo: (id) => solicitud(`/logos/${id}`, { method: 'DELETE' }),

  listarDisenos: () => solicitud('/disenos'),
  crearDiseno: (payload) => solicitud('/disenos', { method: 'POST', body: payload }),
  actualizarDiseno: (id, payload) => solicitud(`/disenos/${id}`, { method: 'PUT', body: payload }),
  eliminarDiseno: (id) => solicitud(`/disenos/${id}`, { method: 'DELETE' }),

  listarEscenas: (partidoId) => solicitud(`/partidos/${partidoId}/escenas`),
  crearEscena: (partidoId, payload) => solicitud(`/partidos/${partidoId}/escenas`, { method: 'POST', body: payload }),
  actualizarEscena: (id, payload) => solicitud(`/escenas/${id}`, { method: 'PUT', body: payload }),
  eliminarEscena: (id) => solicitud(`/escenas/${id}`, { method: 'DELETE' }),

  obtenerEscenaPublica: (token) => solicitud(`/public/escenas/${token}`, { autenticado: false }),

  listarPosiciones: () => solicitud('/posiciones'),
  crearPosicion: (payload) => solicitud('/posiciones', { method: 'POST', body: payload }),
  eliminarPosicion: (id) => solicitud(`/posiciones/${id}`, { method: 'DELETE' }),

  adminListarUsuarios: () => solicitud('/admin/usuarios'),
  adminListarDisenosDeUsuario: (userId) => solicitud(`/admin/usuarios/${userId}/disenos`),
  adminEliminarDiseno: (id) => solicitud(`/admin/disenos/${id}`, { method: 'DELETE' }),
};
