import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import pool from '../db.js';
import { authenticate, firmarToken } from '../middleware/auth.js';
import { enviarEmail } from '../utils/email.js';

const router = Router();

const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
// Más estricto que login: cada intento manda (o intenta mandar) un email de
// verdad, así que un abuso acá sale más caro que un intento de contraseña.
const limiteRecuperacion = rateLimit({ windowMs: 15 * 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false });

// Sin GOOGLE_CLIENT_ID (todavía no se creó el cliente OAuth en Google Cloud
// Console) el cliente de verificación no se arma — /auth/google responde
// "no configurado" en vez de reventar en cada request.
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// "Último uso" del panel de super admin — se toca en cada entrada real a la
// cuenta (registro/login/Google/resetear contraseña) y en /auth/me (que el
// frontend llama una vez por carga de página, ver AuthContext) — no hace
// falta más granularidad que esa para saber "cuándo fue la última vez que
// esta cuenta entró a la app".
const tocarUltimoUso = (id) => pool.query('UPDATE usuarios SET ultimo_uso_en = now() WHERE id = $1', [id]).catch(() => {});

router.post('/registro', limiteLogin, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const nombre = String(req.body?.nombre || '').trim();

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Email y contraseña (mínimo 6 caracteres) son obligatorios' });
  }

  try {
    const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existente.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const resultado = await pool.query(
      'INSERT INTO usuarios (email, password_hash, nombre) VALUES ($1, $2, $3) RETURNING id, email, nombre, es_admin',
      [email, passwordHash, nombre || null]
    );
    const usuario = resultado.rows[0];
    await tocarUltimoUso(usuario.id);
    const token = firmarToken(usuario.id);
    res.status(201).json({ token, usuario });
  } catch (error) {
    console.error('[POST /auth/registro]', error);
    res.status(500).json({ error: 'No se pudo crear la cuenta' });
  }
});

router.post('/login', limiteLogin, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const resultado = await pool.query('SELECT id, email, nombre, password_hash, es_admin FROM usuarios WHERE email = $1', [email]);
    const usuario = resultado.rows[0];
    if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });
    // Cuenta creada con Google: nunca tuvo contraseña propia — avisar en vez
    // de comparar contra null (bcrypt.compare revienta con eso).
    if (!usuario.password_hash) return res.status(401).json({ error: 'Esta cuenta usa Google para ingresar — usá el botón de Google' });

    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) return res.status(401).json({ error: 'Credenciales inválidas' });

    await tocarUltimoUso(usuario.id);
    const token = firmarToken(usuario.id);
    res.json({ token, usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, es_admin: usuario.es_admin } });
  } catch (error) {
    console.error('[POST /auth/login]', error);
    res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
});

// "Olvidé mi contraseña": siempre responde lo mismo exista o no la cuenta
// (no delata qué emails están registrados) — si existe, manda un enlace de
// un solo uso que vence en 1 hora.
router.post('/olvide-password', limiteRecuperacion, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'El email es obligatorio' });

  try {
    const resultado = await pool.query('SELECT id, nombre FROM usuarios WHERE email = $1', [email]);
    const usuario = resultado.rows[0];
    if (usuario) {
      const tokenCrudo = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expira_en) VALUES ($1, $2, now() + interval '1 hour')`,
        [usuario.id, hashToken(tokenCrudo)]
      );
      const origen = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
      const enlace = `${origen}/resetear-password?token=${tokenCrudo}`;
      await enviarEmail({
        para: email,
        asunto: 'Recuperar tu contraseña — App-overlays',
        html: `<p>Hola${usuario.nombre ? ' ' + usuario.nombre : ''},</p><p>Entrá al siguiente enlace para elegir una contraseña nueva (vale por 1 hora):</p><p><a href="${enlace}">${enlace}</a></p><p>Si no pediste esto, ignorá este email — tu contraseña sigue igual.</p>`,
      });
    }
    res.json({ ok: true, mensaje: 'Si el email existe, te enviamos un enlace para recuperar la contraseña' });
  } catch (error) {
    console.error('[POST /auth/olvide-password]', error);
    res.status(500).json({ error: 'No se pudo procesar la solicitud' });
  }
});

router.post('/resetear-password', limiteRecuperacion, async (req, res) => {
  const tokenCrudo = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (!tokenCrudo || !password || password.length < 6) {
    return res.status(400).json({ error: 'Token y contraseña (mínimo 6 caracteres) son obligatorios' });
  }

  try {
    const resultado = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND usado_en IS NULL AND expira_en > now()`,
      [hashToken(tokenCrudo)]
    );
    const fila = resultado.rows[0];
    if (!fila) return res.status(400).json({ error: 'El enlace es inválido o ya venció — pedí uno nuevo' });

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [passwordHash, fila.user_id]);
    // Cualquier otro enlace de reseteo pendiente para este usuario queda
    // invalidado — evita que un enlace viejo (por ejemplo reenviado dos
    // veces) siga siendo válido después de ya haber cambiado la contraseña.
    await pool.query('UPDATE password_reset_tokens SET usado_en = now() WHERE user_id = $1 AND usado_en IS NULL', [fila.user_id]);

    const usuarioResultado = await pool.query('SELECT id, email, nombre, es_admin FROM usuarios WHERE id = $1', [fila.user_id]);
    const usuario = usuarioResultado.rows[0];
    await tocarUltimoUso(usuario.id);
    const token = firmarToken(usuario.id);
    res.json({ token, usuario });
  } catch (error) {
    console.error('[POST /auth/resetear-password]', error);
    res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }
});

// Ingreso/registro con Google (Google Identity Services manda un ID token
// firmado por Google — `credential` — que acá se verifica de verdad contra
// los servidores de Google, nunca se confía en el payload a ciegas).
router.post('/google', limiteLogin, async (req, res) => {
  const credential = String(req.body?.credential || '');
  if (!credential) return res.status(400).json({ error: 'Falta el token de Google' });
  if (!googleClient) return res.status(500).json({ error: 'El ingreso con Google no está configurado en el servidor' });

  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: 'No se pudo verificar el email de Google' });
    }
    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const nombre = payload.name || null;

    let usuario = (await pool.query('SELECT id, email, nombre, es_admin FROM usuarios WHERE google_id = $1', [googleId])).rows[0];

    if (!usuario) {
      usuario = (await pool.query('SELECT id, email, nombre, es_admin FROM usuarios WHERE email = $1', [email])).rows[0];
      if (usuario) {
        // Ya había una cuenta con este email (creada con contraseña) — se
        // vincula Google a ESA cuenta en vez de crear una duplicada; Google
        // ya verificó que el email es suyo, así que vincular es seguro.
        await pool.query('UPDATE usuarios SET google_id = $1 WHERE id = $2', [googleId, usuario.id]);
      } else {
        usuario = (await pool.query(
          'INSERT INTO usuarios (email, nombre, google_id) VALUES ($1, $2, $3) RETURNING id, email, nombre, es_admin',
          [email, nombre, googleId]
        )).rows[0];
      }
    }

    await tocarUltimoUso(usuario.id);
    const token = firmarToken(usuario.id);
    res.json({ token, usuario });
  } catch (error) {
    console.error('[POST /auth/google]', error);
    res.status(401).json({ error: 'No se pudo verificar la sesión de Google' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const resultado = await pool.query('SELECT id, email, nombre, es_admin FROM usuarios WHERE id = $1', [req.userId]);
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    tocarUltimoUso(req.userId); // sin await a propósito: no vale la pena demorar la respuesta por esto
    res.json({ usuario: resultado.rows[0] });
  } catch (error) {
    console.error('[GET /auth/me]', error);
    res.status(500).json({ error: 'No se pudo obtener el usuario' });
  }
});

export default router;
