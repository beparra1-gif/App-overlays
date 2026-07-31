import { useEffect, useState } from 'react';
import { api } from '../api/client';

function fecha(iso) {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Panel de diseños de un usuario puntual — se abre al hacer click en la
// fila, para no cargar los diseños de TODOS los usuarios de entrada (la
// mayoría de las veces nadie los va a mirar).
function DisenosDeUsuario({ usuario, onCerrar }) {
  const [disenos, setDisenos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.adminListarDisenosDeUsuario(usuario.id).then((d) => setDisenos(d.disenos)).catch((err) => setError(err.message));
  }, [usuario.id]);

  const eliminar = async (diseno) => {
    if (!window.confirm(`¿Eliminar el diseño "${diseno.nombre}" de ${usuario.email}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.adminEliminarDiseno(diseno.id);
      setDisenos((lista) => lista.filter((d) => d.id !== diseno.id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="tarjeta" style={{ marginTop: 8 }}>
      <div className="tarjeta-header">
        <strong>Diseños de {usuario.email}</strong>
        <button className="btn-link" onClick={onCerrar}>Cerrar</button>
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      {!disenos && <p className="texto-tenue">Cargando…</p>}
      {disenos && disenos.length === 0 && <p className="texto-tenue">Este usuario todavía no tiene diseños.</p>}
      {disenos && disenos.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {disenos.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--borde)' }}>
                <td style={{ padding: '8px 4px' }}>{d.nombre}</td>
                <td style={{ padding: '8px 4px' }} className="texto-tenue">{d.plantilla_base}</td>
                <td style={{ padding: '8px 4px' }} className="texto-tenue">{fecha(d.creado_en)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                  <button className="btn-link" onClick={() => eliminar(d)}>🗑️ Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Admin() {
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState('');
  const [usuarioAbierto, setUsuarioAbierto] = useState(null);

  useEffect(() => {
    api.adminListarUsuarios().then((d) => setUsuarios(d.usuarios)).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="pagina">
      <h1>Panel de administración</h1>
      <p className="texto-tenue">Todas las cuentas registradas en App-overlays, cuándo entraron por última vez, y cuánto tienen creado.</p>
      {error && <p className="mensaje-error">{error}</p>}
      {!usuarios && <p className="texto-tenue">Cargando…</p>}
      {usuarios && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--borde)' }}>
                <th style={{ padding: '8px 4px' }}>Usuario</th>
                <th style={{ padding: '8px 4px' }}>Registrado</th>
                <th style={{ padding: '8px 4px' }}>Último uso</th>
                <th style={{ padding: '8px 4px' }}>Diseños</th>
                <th style={{ padding: '8px 4px' }}>Equipos</th>
                <th style={{ padding: '8px 4px' }}>Partidos</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: '1px solid var(--borde)', cursor: 'pointer' }}
                  onClick={() => setUsuarioAbierto(usuarioAbierto?.id === u.id ? null : u)}
                >
                  <td style={{ padding: '10px 4px' }}>
                    {u.email} {u.es_admin && <span className="chip-en-uso" style={{ marginLeft: 6 }}>admin</span>}
                    {u.nombre && <div className="texto-tenue" style={{ fontSize: 12 }}>{u.nombre}</div>}
                  </td>
                  <td style={{ padding: '10px 4px' }} className="texto-tenue">{fecha(u.creado_en)}</td>
                  <td style={{ padding: '10px 4px' }} className="texto-tenue">{fecha(u.ultimo_uso_en)}</td>
                  <td style={{ padding: '10px 4px' }}>{u.disenos_count}</td>
                  <td style={{ padding: '10px 4px' }}>{u.equipos_count}</td>
                  <td style={{ padding: '10px 4px' }}>{u.partidos_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {usuarioAbierto && <DisenosDeUsuario usuario={usuarioAbierto} onCerrar={() => setUsuarioAbierto(null)} />}
    </div>
  );
}
