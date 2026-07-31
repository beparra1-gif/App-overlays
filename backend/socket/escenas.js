import pool from '../db.js';

export async function cargarEscenaPorToken(token) {
  const resultado = await pool.query('SELECT * FROM escenas WHERE public_token = $1', [token]);
  return resultado.rows[0] || null;
}

export async function cargarEscenaConDiseno(token) {
  const escena = await cargarEscenaPorToken(token);
  if (!escena) return null;

  let diseno = null;
  if (escena.diseno_id) {
    const resultado = await pool.query('SELECT * FROM disenos_guardados WHERE id = $1', [escena.diseno_id]);
    diseno = resultado.rows[0] || null;
  }

  return { escena, diseno };
}
