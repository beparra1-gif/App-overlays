import jwt from 'jsonwebtoken';
import pool from '../db.js';

// Cada token lleva la "versión de sesión" del usuario (`v`). Cambiar o
// recuperar la contraseña, o vincular Google, sube esa versión: todos los
// tokens anteriores (incluidos los enlaces del lector) dejan de servir.
// Tokens viejos sin `v` cuentan como versión 0.
export async function versionDeSesion(userId) {
  const r = await pool.query('SELECT sesion_version FROM usuarios WHERE id = $1', [userId]);
  return r.rows[0] ? r.rows[0].sesion_version : null;
}

// Payload del token si es válido, está vigente y su versión es la actual; si no, null.
// Los enlaces de operador además tienen su propia versión (`ov`): subirla los anula a todos.
export async function verificarSesion(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const r = await pool.query('SELECT sesion_version, operador_version FROM usuarios WHERE id = $1', [payload.userId]);
    const u = r.rows[0];
    if (!u || (payload.v || 0) !== u.sesion_version) return null;
    if (payload.scope === 'operador' && (payload.ov || 0) !== u.operador_version) return null;
    return payload;
  } catch {
    return null;
  }
}

// Qué puede hacer un operador por la API: leer todo y manejar el partido
// (quintetos, enlace del lector, sumar jugadoras a la nómina), nunca borrar
// ni tocar diseños, equipos, logos, publicidad o la cuenta.
function operadorPuede(req) {
  if (req.method === 'GET') return true;
  const ruta = `${req.baseUrl}${req.path}`;
  if (req.method === 'DELETE') return false;
  return ruta.startsWith('/api/partidos/')
    || (req.method === 'POST' && /^\/api\/equipos\/\d+\/jugadores$/.test(ruta))
    || (req.method === 'PUT' && /^\/api\/jugadores\/\d+$/.test(ruta));
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const payload = await verificarSesion(token);
  // Tokens de alcance limitado (p. ej. el enlace del lector por cámara,
  // `scope: 'lector'`) NO sirven para la API: solo para las acciones
  // puntuales que el socket les permite.
  if (!payload || (payload.scope && payload.scope !== 'operador')) return res.status(401).json({ error: 'Sesión inválida o expirada' });
  if (payload.scope === 'operador' && !operadorPuede(req)) return res.status(403).json({ error: 'Un operador de Mesa no puede hacer esto' });
  req.userId = payload.userId;
  req.esOperador = payload.scope === 'operador';
  next();
}

// Enlace de operador: maneja la Mesa de los partidos de la cuenta, sin
// acceso a lo demás. Dura 30 días o hasta que el dueño los anule.
export function firmarTokenOperador(userId, version, versionOperador) {
  return jwt.sign({ userId, scope: 'operador', v: version, ov: versionOperador }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

export function firmarToken(userId, version = 0) {
  return jwt.sign({ userId, v: version }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// Enlace del lector de marcador por cámara: solo puede tocar ESE partido y
// solo las acciones de reloj/marcador (ver ACCIONES_LECTOR en socket/index.js).
export function firmarTokenLector(userId, partidoId, version = 0) {
  return jwt.sign({ userId, partidoId, scope: 'lector', v: version }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export async function verificarTokenLector(token) {
  const payload = await verificarSesion(token);
  return payload?.scope === 'lector' ? payload : null;
}
