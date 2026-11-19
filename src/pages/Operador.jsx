import { useEffect, useState } from 'react';
import { setToken } from '../api/client';

// Entrada por enlace de operador (/operador#<token>): guarda el acceso y
// abre la Mesa del partido en vivo. El token va en el "#" para que nunca
// viaje al servidor ni quede en los registros.
export default function Operador() {
  const [error, setError] = useState('');
  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (!token) { setError('El enlace de operador está incompleto. Pedí uno nuevo.'); return; }
    setToken(token);
    window.location.replace('/en-vivo');
  }, []);
  return <div className="pagina-centrada">{error ? <p className="mensaje-error">{error}</p> : 'Entrando a la Mesa…'}</div>;
}
