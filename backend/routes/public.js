import { Router } from 'express';
import { cargarPartidoPorToken, cargarPartidoPorId, construirEstado } from '../socket/estadoPartido.js';
import { cargarEscenaConDiseno } from '../socket/escenas.js';

const router = Router();

router.get('/partidos/:token', async (req, res) => {
  const partido = await cargarPartidoPorToken(req.params.token);
  if (!partido) return res.status(404).json({ error: 'Marcador no encontrado' });
  res.json({ partido: await construirEstado(partido) });
});

router.get('/escenas/:token', async (req, res) => {
  const resultado = await cargarEscenaConDiseno(req.params.token);
  if (!resultado) return res.status(404).json({ error: 'Escena no encontrada' });

  const partido = await cargarPartidoPorId(resultado.escena.partido_id);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

  res.json({ escena: resultado.escena, diseno: resultado.diseno, partido: await construirEstado(partido) });
});

export default router;
