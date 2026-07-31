import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ResetearPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { resetearPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmar) {
      setError('Las dos contraseñas no coinciden');
      return;
    }
    setEnviando(true);
    try {
      await resetearPassword(token, password);
      navigate('/disenos');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!token) {
    return (
      <div className="pagina-centrada">
        <div className="tarjeta-form">
          <h1>Enlace inválido</h1>
          <p>Este enlace no trae el código de recuperación. Pedí uno nuevo.</p>
          <p><Link to="/olvide-password">Pedir un enlace nuevo</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="pagina-centrada">
      <form className="tarjeta-form" onSubmit={enviar}>
        <h1>Elegí una contraseña nueva</h1>
        {error && <p className="mensaje-error">{error}</p>}
        <label>
          Contraseña nueva (mínimo 6 caracteres)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoFocus />
        </label>
        <label>
          Repetila
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={6} />
        </label>
        <button className="btn-primario" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </div>
  );
}
