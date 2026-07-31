import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Se busca fresco en la base en cada request (no se confía en un flag
// guardado dentro del JWT) — el token dura 30 días, así que si algún día se
// le saca el admin a una cuenta, no debe seguir funcionando hasta que
// venza el token viejo.
async function requerirAdmin(req, res, next) {
  try {
    const resultado = await pool.query('SELECT es_admin FROM usuarios WHERE id = $1', [req.userId]);
    if (!resultado.rows[0]?.es_admin) return res.status(403).json({ error: 'No autorizado' });
    next();
  } catch (error) {
    console.error('[admin] requerirAdmin', error);
    res.status(500).json({ error: 'No se pudo verificar el acceso' });
  }
}
router.use(requerirAdmin);

router.get('/usuarios', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.creado_en, u.ultimo_uso_en, u.es_admin,
         (SELECT COUNT(*) FROM disenos_guardados d WHERE d.user_id = u.id)::int AS disenos_count,
         (SELECT COUNT(*) FROM equipos e WHERE e.user_id = u.id)::int AS equipos_count,
         (SELECT COUNT(*) FROM partidos p WHERE p.user_id = u.id)::int AS partidos_count
       FROM usuarios u
       ORDER BY u.ultimo_uso_en DESC NULLS LAST, u.creado_en DESC`
    );
    res.json({ usuarios: resultado.rows });
  } catch (error) {
    console.error('[GET /admin/usuarios]', error);
    res.status(500).json({ error: 'No se pudieron obtener los usuarios' });
  }
});

router.get('/usuarios/:id/disenos', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, plantilla_base, creado_en FROM disenos_guardados WHERE user_id = $1 ORDER BY creado_en DESC',
      [req.params.id]
    );
    res.json({ disenos: resultado.rows });
  } catch (error) {
    console.error('[GET /admin/usuarios/:id/disenos]', error);
    res.status(500).json({ error: 'No se pudieron obtener los diseños' });
  }
});

// A diferencia de DELETE /disenos/:id (cada usuario solo puede borrar los
// suyos), esta ruta no filtra por dueño — es la excepción explícita que
// pidió el super admin.
router.delete('/disenos/:id', async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM disenos_guardados WHERE id = $1 RETURNING id', [req.params.id]);
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Diseño no encontrado' });
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /admin/disenos/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el diseño' });
  }
});

export default router;
