import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import pool from '../db.js';
import { authenticate, firmarToken, firmarTokenOperador } from '../middleware/auth.js';
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
      `INSERT INTO usuarios (email, password_hash, nombre) VALUES ($1, $2, $3)
       RETURNING id, email, nombre, es_admin, creado_en, true AS tiene_password, false AS tiene_google`,
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
    const resultado = await pool.query('SELECT id, email, nombre, password_hash, google_id, es_admin, creado_en, sesion_version FROM usuarios WHERE email = $1', [email]);
    const usuario = resultado.rows[0];
    if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });
    // Cuenta creada con Google: nunca tuvo contraseña propia — avisar en vez
    // de comparar contra null (bcrypt.compare revienta con eso).
    if (!usuario.password_hash) return res.status(401).json({ error: 'Esta cuenta usa Google para ingresar — usá el botón de Google' });

    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) return res.status(401).json({ error: 'Credenciales inválidas' });

    await tocarUltimoUso(usuario.id);
    const token = firmarToken(usuario.id, usuario.sesion_version);
    res.json({
      token,
      usuario: {
        id: usuario.id, email: usuario.email, nombre: usuario.nombre, es_admin: usuario.es_admin, creado_en: usuario.creado_en,
        tiene_password: true, tiene_google: Boolean(usuario.google_id),
      },
    });
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
      const origen = (process.env.FRONTEND_URL || 'http://localhost:5183').split(',')[0].trim();
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
    // Sube la versión de sesión: cualquier sesión abierta antes (p. ej. un token robado) deja de servir.
    const { sesion_version: version } = (await pool.query(
      'UPDATE usuarios SET password_hash = $1, sesion_version = sesion_version + 1 WHERE id = $2 RETURNING sesion_version',
      [passwordHash, fila.user_id]
    )).rows[0];
    // Cualquier otro enlace de reseteo pendiente para este usuario queda
    // invalidado — evita que un enlace viejo (por ejemplo reenviado dos
    // veces) siga siendo válido después de ya haber cambiado la contraseña.
    await pool.query('UPDATE password_reset_tokens SET usado_en = now() WHERE user_id = $1 AND usado_en IS NULL', [fila.user_id]);

    const usuarioResultado = await pool.query(
      `SELECT id, email, nombre, es_admin, creado_en, true AS tiene_password, (google_id IS NOT NULL) AS tiene_google
       FROM usuarios WHERE id = $1`,
      [fila.user_id]
    );
    const usuario = usuarioResultado.rows[0];
    await tocarUltimoUso(usuario.id);
    const token = firmarToken(usuario.id, version);
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

    const COLUMNAS = 'id, email, nombre, es_admin, creado_en, password_hash, google_id, sesion_version';
    let usuario = (await pool.query(`SELECT ${COLUMNAS} FROM usuarios WHERE google_id = $1`, [googleId])).rows[0];

    if (!usuario) {
      usuario = (await pool.query(`SELECT ${COLUMNAS} FROM usuarios WHERE email = $1`, [email])).rows[0];
      if (usuario) {
        // Ya había una cuenta con este email — se vincula Google a ESA
        // cuenta. Como el registro y el cambio de email no verifican el
        // email, esa cuenta pudo haberla creado otra persona: se borra la
        // contraseña y se cierran todas sus sesiones, así queda solo en
        // manos de quien probó con Google que el email es suyo (después
        // puede crear una contraseña nueva desde "Mi perfil").
        usuario = (await pool.query(
          `UPDATE usuarios SET google_id = $1, password_hash = NULL, sesion_version = sesion_version + 1 WHERE id = $2 RETURNING ${COLUMNAS}`,
          [googleId, usuario.id]
        )).rows[0];
      } else {
        usuario = (await pool.query(
          `INSERT INTO usuarios (email, nombre, google_id) VALUES ($1, $2, $3) RETURNING ${COLUMNAS}`,
          [email, nombre, googleId]
        )).rows[0];
      }
    }

    await tocarUltimoUso(usuario.id);
    const token = firmarToken(usuario.id, usuario.sesion_version);
    res.json({
      token,
      usuario: {
        id: usuario.id, email: usuario.email, nombre: usuario.nombre, es_admin: usuario.es_admin, creado_en: usuario.creado_en,
        tiene_password: Boolean(usuario.password_hash), tiene_google: true,
      },
    });
  } catch (error) {
    console.error('[POST /auth/google]', error);
    res.status(401).json({ error: 'No se pudo verificar la sesión de Google' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, email, nombre, es_admin, creado_en, (password_hash IS NOT NULL) AS tiene_password, (google_id IS NOT NULL) AS tiene_google
       FROM usuarios WHERE id = $1`,
      [req.userId]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    tocarUltimoUso(req.userId); // sin await a propósito: no vale la pena demorar la respuesta por esto
    res.json({ usuario: { ...resultado.rows[0], operador: Boolean(req.esOperador) } });
  } catch (error) {
    console.error('[GET /auth/me]', error);
    res.status(500).json({ error: 'No se pudo obtener el usuario' });
  }
});

// Editar nombre/email desde "Mi perfil" — el email se valida único (case
// insensitive) porque sigue siendo la clave de login; cambiarlo es seguro
// incluso para una cuenta vinculada a Google, ya que ese ingreso matchea
// primero por google_id (ver POST /google) y solo cae a email para
// detectar una cuenta previa la primerísima vez que se vincula.
router.put('/perfil', authenticate, async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'El email es obligatorio' });

  try {
    const enUso = await pool.query('SELECT id FROM usuarios WHERE email = $1 AND id <> $2', [email, req.userId]);
    if (enUso.rows.length > 0) return res.status(409).json({ error: 'Ya hay otra cuenta con ese email' });

    const resultado = await pool.query(
      `UPDATE usuarios SET nombre = $1, email = $2 WHERE id = $3
       RETURNING id, email, nombre, es_admin, creado_en, (password_hash IS NOT NULL) AS tiene_password, (google_id IS NOT NULL) AS tiene_google`,
      [nombre || null, email, req.userId]
    );
    res.json({ usuario: resultado.rows[0] });
  } catch (error) {
    console.error('[PUT /auth/perfil]', error);
    res.status(500).json({ error: 'No se pudo actualizar el perfil' });
  }
});

// Cambiar (o, para una cuenta que entró siempre con Google, agregar por
// primera vez) una contraseña — si ya tenía una, pide la actual para
// confirmar que es realmente el dueño de la cuenta antes de reemplazarla.
router.put('/password', authenticate, async (req, res) => {
  const passwordActual = String(req.body?.passwordActual || '');
  const passwordNueva = String(req.body?.passwordNueva || '');
  if (!passwordNueva || passwordNueva.length < 6) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' });
  }

  try {
    const resultado = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.userId]);
    const usuario = resultado.rows[0];
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (usuario.password_hash) {
      if (!passwordActual) return res.status(400).json({ error: 'Ingresá tu contraseña actual' });
      const coincide = await bcrypt.compare(passwordActual, usuario.password_hash);
      if (!coincide) return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    // Cierra las demás sesiones; esta sigue con el token nuevo que se devuelve.
    const { sesion_version: version } = (await pool.query(
      'UPDATE usuarios SET password_hash = $1, sesion_version = sesion_version + 1 WHERE id = $2 RETURNING sesion_version',
      [passwordHash, req.userId]
    )).rows[0];
    res.json({ ok: true, token: firmarToken(req.userId, version) });
  } catch (error) {
    console.error('[PUT /auth/password]', error);
    res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }
});

// Enlaces de operador de Mesa (solo el dueño de la cuenta, no otro operador).
router.post('/operador', authenticate, async (req, res) => {
  if (req.esOperador) return res.status(403).json({ error: 'Un operador no puede crear enlaces' });
  try {
    const u = (await pool.query('SELECT sesion_version, operador_version FROM usuarios WHERE id = $1', [req.userId])).rows[0];
    res.json({ token: firmarTokenOperador(req.userId, u.sesion_version, u.operador_version), expiraEnDias: 30 });
  } catch (error) {
    console.error('[POST /auth/operador]', error);
    res.status(500).json({ error: 'No se pudo crear el enlace' });
  }
});
router.delete('/operador', authenticate, async (req, res) => {
  if (req.esOperador) return res.status(403).json({ error: 'Un operador no puede anular enlaces' });
  try {
    await pool.query('UPDATE usuarios SET operador_version = operador_version + 1 WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /auth/operador]', error);
    res.status(500).json({ error: 'No se pudieron anular los enlaces' });
  }
});

export default router;
