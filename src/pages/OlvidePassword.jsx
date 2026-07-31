import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function OlvidePassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      // Siempre responde lo mismo exista o no la cuenta (ver backend) — el
      // mensaje de éxito no confirma que el email esté registrado.
      await api.olvidePassword(email);
      setEnviado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="pagina-centrada">
        <div className="tarjeta-form">
          <h1>Revisá tu email</h1>
          <p>Si <strong>{email}</strong> tiene una cuenta, te mandamos un enlace para elegir una contraseña nueva. Vale por 1 hora.</p>
          <p><Link to="/login">← Volver a iniciar sesión</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="pagina-centrada">
      <form className="tarjeta-form" onSubmit={enviar}>
        <h1>Recuperar contraseña</h1>
        {error && <p className="mensaje-error">{error}</p>}
        <label>
          Email de tu cuenta
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <button className="btn-primario" type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar enlace'}
        </button>
        <p><Link to="/login">← Volver a iniciar sesión</Link></p>
      </form>
    </div>
  );
}
