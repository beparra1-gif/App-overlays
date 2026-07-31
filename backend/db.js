import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const urlCruda = process.env.DATABASE_URL || '';
const esLocal = urlCruda.includes('localhost') || urlCruda.includes('127.0.0.1');

// Los proveedores gestionados (DigitalOcean, etc.) agregan `sslmode=require`
// a la connection string — eso hace que pg-connection-string arme SU PROPIA
// config de SSL a partir de la URL y la use en vez del `ssl:
// {rejectUnauthorized:false}` de acá abajo, terminando en "self-signed
// certificate in certificate chain" aunque ya le hayamos dicho que no
// valide el certificado. Se lo saca de la URL para que el ÚNICO lugar que
// decide la config de SSL sea el objeto `ssl` explícito de este archivo.
const urlSinSslmode = urlCruda.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');

const pool = new Pool({
  connectionString: urlSinSslmode,
  ssl: esLocal ? false : { rejectUnauthorized: false },
});

export default pool;
