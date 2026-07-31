import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BotonGoogle from '../components/BotonGoogle';

export default function Registro() {
  const { registro, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await registro(email, password, nombre);
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
        <h1>Crear cuenta</h1>
        {error && <p className="mensaje-error">{error}</p>}
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña (mínimo 6 caracteres)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        <button className="btn-primario" type="submit" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>
        <BotonGoogle onCredential={conGoogle} onError={setError} />
        <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </form>
    </div>
  );
}
