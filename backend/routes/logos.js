import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.mimetype)) {
      return cb(new Error('Formato no soportado (usa PNG, JPG, WEBP o SVG)'));
    }
    cb(null, true);
  },
});

router.get('/', authenticate, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, filename, mime_type, creado_en FROM logos WHERE user_id = $1 ORDER BY creado_en DESC',
      [req.userId]
    );
    res.json({ logos: resultado.rows });
  } catch (error) {
    console.error('[GET /logos]', error);
    res.status(500).json({ error: 'No se pudieron obtener los logos' });
  }
});

router.post('/', authenticate, (req, res) => {
  upload.single('archivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

    const nombre = String(req.body?.nombre || req.file.originalname || 'logo').trim();
    const extension = (req.file.originalname.split('.').pop() || 'png').toLowerCase();
    const filename = `${crypto.randomBytes(10).toString('hex')}.${extension}`;

    try {
      await pool.query(
        'INSERT INTO logos (user_id, nombre, filename, mime_type, file_data) VALUES ($1, $2, $3, $4, $5)',
        [req.userId, nombre, filename, req.file.mimetype, req.file.buffer]
      );
      res.status(201).json({ logo: { filename, nombre, mime_type: req.file.mimetype } });
    } catch (error) {
      console.error('[POST /logos]', error);
      res.status(500).json({ error: 'No se pudo guardar el logo' });
    }
  });
});

router.put('/:id', authenticate, async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'El título no puede quedar vacío' });

  try {
    const resultado = await pool.query(
      'UPDATE logos SET nombre = $1 WHERE id = $2 AND user_id = $3 RETURNING id, nombre, filename, mime_type, creado_en',
      [nombre, req.params.id, req.userId]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Logo no encontrado' });
    res.json({ logo: resultado.rows[0] });
  } catch (error) {
    console.error('[PUT /logos/:id]', error);
    res.status(500).json({ error: 'No se pudo renombrar el logo' });
  }
});

router.get('/file/:filename', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT mime_type, file_data FROM logos WHERE filename = $1', [req.params.filename]);
    const logo = resultado.rows[0];
    if (!logo) return res.status(404).end();
    res.setHeader('Content-Type', logo.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(logo.file_data);
  } catch (error) {
    console.error('[GET /logos/file/:filename]', error);
    res.status(500).end();
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM logos WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.userId,
    ]);
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Logo no encontrado' });
    res.status(204).end();
  } catch (error) {
    console.error('[DELETE /logos/:id]', error);
    res.status(500).json({ error: 'No se pudo eliminar el logo' });
  }
});

export default router;
