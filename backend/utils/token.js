import crypto from 'crypto';

export const generarToken = () => crypto.randomBytes(12).toString('hex');
