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
export async function verificarSesion(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const version = await versionDeSesion(payload.userId);
    return version !== null && (payload.v || 0) === version ? payload : null;
  } catch {
    return null;
  }
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const payload = await verificarSesion(token);
  // Tokens de alcance limitado (p. ej. el enlace del lector por cámara,
  // `scope: 'lector'`) NO sirven para la API: solo para las acciones
  // puntuales que el socket les permite.
  if (!payload || payload.scope) return res.status(401).json({ error: 'Sesión inválida o expirada' });
  req.userId = payload.userId;
  next();
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
