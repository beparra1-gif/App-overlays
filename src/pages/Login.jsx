import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BotonGoogle from '../components/BotonGoogle';

export default function Login() {
  const { login, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(email, password);
      navigate('/disenos');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const conGoogle = async (credential) => {
    setError('');
    try {
      await loginGoogle(credential);
      navigate('/disenos');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="pagina-centrada">
      <form className="tarjeta-form" onSubmit={enviar}>
        <h1>Iniciar sesión</h1>
        {error && <p className="mensaje-error">{error}</p>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn-primario" type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p style={{ margin: 0 }}><Link to="/olvide-password">¿Olvidaste tu contraseña?</Link></p>
        <BotonGoogle onCredential={conGoogle} onError={setError} />
        <p>¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
      </form>
    </div>
  );
}
