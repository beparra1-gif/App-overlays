import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import equiposRoutes from './routes/equipos.js';
import jugadoresRoutes from './routes/jugadores.js';
import partidosRoutes from './routes/partidos.js';
import partidosArchivadosRoutes from './routes/partidosArchivados.js';
import temporadasRoutes from './routes/temporadas.js';
import publicRoutes from './routes/public.js';
import patrocinadoresRoutes from './routes/patrocinadores.js';
import logosRoutes from './routes/logos.js';
import disenosRoutes from './routes/disenos.js';
import escenasRoutes from './routes/escenas.js';
import posicionesRoutes from './routes/posiciones.js';
import plantillasPersonalizadasRoutes from './routes/plantillasPersonalizadas.js';
import adminRoutes from './routes/admin.js';
import { registrarSocketPartidos } from './socket/index.js';

dotenv.config();

const app = express();
// Detrás del balanceador de DigitalOcean: sin esto todos los usuarios llegan
// con la misma IP y el límite de intentos de login se comparte entre todos.
app.set('trust proxy', 1);
const server = http.createServer(app);

const origenesPermitidos = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = { origin: origenesPermitidos.length ? origenesPermitidos : true };

app.use(cors(corsOptions));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/jugadores', jugadoresRoutes);
app.use('/api/partidos', partidosRoutes);
app.use('/api/partidos-archivados', partidosArchivadosRoutes);
app.use('/api/temporadas', temporadasRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/patrocinadores', patrocinadoresRoutes);
app.use('/api/logos', logosRoutes);
app.use('/api/disenos', disenosRoutes);
app.use('/api/escenas', escenasRoutes);
app.use('/api/posiciones', posicionesRoutes);
app.use('/api/plantillas-personalizadas', plantillasPersonalizadasRoutes);
app.use('/api/admin', adminRoutes);

// Red de seguridad: cualquier error que se escape de una ruta responde 500
// en vez de dejar la petición colgada.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[express]', err);
  if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
});

// Un `await` sin try/catch en una ruta async (Express 4 no los atrapa) o en
// un handler de socket era un unhandled rejection: en Node moderno eso
// TUMBA el proceso — en pleno partido, se caía el marcador de todos. Se
// registra y se sigue.
process.on('unhandledRejection', (razon) => console.error('[unhandledRejection]', razon));

const io = new Server(server, { cors: corsOptions });
app.locals.io = io;
registrarSocketPartidos(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend App-overlays escuchando en puerto ${PORT}`));
