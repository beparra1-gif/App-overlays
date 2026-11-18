import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Tokens de alcance limitado (p. ej. el enlace del lector por cámara,
    // `scope: 'lector'`) NO sirven para la API: solo para las acciones
    // puntuales que el socket les permite.
    if (payload.scope) return res.status(401).json({ error: 'Sesión inválida o expirada' });
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

export function firmarToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// Enlace del lector de marcador por cámara: solo puede tocar ESE partido y
// solo las acciones de reloj/marcador (ver ACCIONES_LECTOR en socket/index.js).
export function firmarTokenLector(userId, partidoId) {
  return jwt.sign({ userId, partidoId, scope: 'lector' }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export function verificarTokenLector(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.scope === 'lector' ? payload : null;
  } catch {
    return null;
  }
}
