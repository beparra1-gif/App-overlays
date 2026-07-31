import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function iniciales(usuario) {
  const base = (usuario.nombre || usuario.email || '?').trim();
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function fecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function SeccionDatos({ usuario, onGuardar }) {
  const [nombre, setNombre] = useState(usuario.nombre || '');
  const [email, setEmail] = useState(usuario.email || '');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      await onGuardar({ nombre, email });
      setMensaje('Guardado');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="tarjeta perfil-seccion" onSubmit={enviar}>
      <h3>Datos de la cuenta</h3>
      {error && <p className="mensaje-error">{error}</p>}
      {mensaje && <p className="perfil-mensaje-ok">{mensaje}</p>}
      <label>
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" />
      </label>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <button className="btn-primario" type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}

function SeccionPassword({ usuario }) {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    if (passwordNueva !== confirmar) {
      setError('Las dos contraseñas no coinciden');
      return;
    }
    setGuardando(true);
    try {
      await api.cambiarPassword({ passwordActual, passwordNueva });
      setPasswordActual('');
      setPasswordNueva('');
      setConfirmar('');
      setMensaje(usuario.tiene_password ? 'Contraseña actualizada' : 'Ya podés entrar también con email y contraseña');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="tarjeta perfil-seccion" onSubmit={enviar}>
      <h3>Contraseña</h3>
      {!usuario.tiene_password && (
        <p className="texto-tenue">
          Tu cuenta entra con Google. Si querés, podés agregar una contraseña para poder entrar también con tu email.
        </p>
      )}
      {error && <p className="mensaje-error">{error}</p>}
      {mensaje && <p className="perfil-mensaje-ok">{mensaje}</p>}
      {usuario.tiene_password && (
        <label>
          Contraseña actual
          <input type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} required />
        </label>
      )}
      <label>
        {usuario.tiene_password ? 'Contraseña nueva' : 'Elegí una contraseña'} (mínimo 6 caracteres)
        <input type="password" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} required minLength={6} />
      </label>
      <label>
        Repetila
        <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={6} />
      </label>
      <button className="btn-primario" type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : usuario.tiene_password ? 'Actualizar contraseña' : 'Agregar contraseña'}
      </button>
    </form>
  );
}

export default function Perfil() {
  const { usuario, actualizarPerfil } = useAuth();
  if (!usuario) return null;

  return (
    <div className="pagina perfil-pagina">
      <div className="perfil-header">
        <span className="perfil-avatar">{iniciales(usuario)}</span>
        <div>
          <h1 style={{ margin: 0 }}>{usuario.nombre || 'Mi perfil'}</h1>
          <p className="texto-tenue" style={{ margin: '2px 0 0' }}>
            {usuario.email}
            {usuario.es_admin && <span className="chip-en-uso" style={{ marginLeft: 8 }}>admin</span>}
          </p>
          {usuario.creado_en && <p className="texto-tenue" style={{ margin: '2px 0 0', fontSize: 12 }}>Miembro desde el {fecha(usuario.creado_en)}</p>}
          {usuario.tiene_google && <p className="texto-tenue" style={{ margin: '2px 0 0', fontSize: 12 }}>🔗 Cuenta vinculada a Google</p>}
        </div>
      </div>

      <SeccionDatos usuario={usuario} onGuardar={actualizarPerfil} />
      <SeccionPassword usuario={usuario} />
    </div>
  );
}
