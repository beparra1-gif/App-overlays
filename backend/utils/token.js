import crypto from 'crypto';

export const generarToken = () => crypto.randomBytes(12).toString('hex');

// URL pública de la foto de una jugadora: por un token al azar (nunca por el
// id correlativo, que dejaba recorrer las fotos de todas las cuentas).
export const urlFotoJugador = (j) => (j.tiene_foto && j.foto_token ? `/jugadores/foto/${j.foto_token}` : null);
