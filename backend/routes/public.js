import { Router } from 'express';
import { cargarPartidoPorToken, cargarPartidoPorId, construirEstado } from '../socket/estadoPartido.js';
import { cargarEscenaConDiseno } from '../socket/escenas.js';
import { verificarTokenLector } from '../middleware/auth.js';
import pool from '../db.js';
import { calcularTabla } from './temporadas.js';

const router = Router();

router.get('/partidos/:token', async (req, res, next) => {
  try {
    const partido = await cargarPartidoPorToken(req.params.token);
    if (!partido) return res.status(404).json({ error: 'Marcador no encontrado' });
    res.json({ partido: await construirEstado(partido) });
  } catch (error) {
    next(error);
  }
});

router.get('/escenas/:token', async (req, res, next) => {
  try {
  const resultado = await cargarEscenaConDiseno(req.params.token);
  if (!resultado) return res.status(404).json({ error: 'Escena no encontrada' });

  const partido = await cargarPartidoPorId(resultado.escena.partido_id);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

  res.json({ escena: resultado.escena, diseno: resultado.diseno, partido: await construirEstado(partido) });
  } catch (error) {
    next(error);
  }
});

// Lector de marcador por cámara (enlace/QR sin login): devuelve el estado
// del partido al que apunta el token. El token no sirve para nada más.
router.get('/lector/:token', async (req, res, next) => {
  try {
    const datos = await verificarTokenLector(req.params.token);
    if (!datos) return res.status(401).json({ error: 'El enlace del lector venció o no es válido. Generá uno nuevo desde la Mesa.' });
    const partido = await cargarPartidoPorId(datos.partidoId);
    if (!partido || partido.user_id !== datos.userId) return res.status(404).json({ error: 'Partido no encontrado' });
    res.json({ partido: await construirEstado(partido) });
  } catch (error) {
    next(error);
  }
});

// Tabla de posiciones de la categoría/rama del equipo local de ESE partido,
// para la pantalla "Tabla" de la transmisión (escena pública, sin login).
router.get('/tabla/:token', async (req, res, next) => {
  try {
    const partido = await cargarPartidoPorToken(req.params.token);
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
    const eq = (await pool.query('SELECT categoria, rama FROM equipos WHERE id = $1', [partido.equipo_local_id])).rows[0] || {};
    res.json({ categoria: eq.categoria || null, rama: eq.rama || null, tabla: await calcularTabla(partido.user_id, eq.categoria ?? '', eq.rama ?? '') });
  } catch (error) {
    next(error);
  }
});

export default router;
