import { useEffect, useRef } from 'react';

let scriptCargado = null;
function cargarScriptGoogle() {
  if (scriptCargado) return scriptCargado;
  scriptCargado = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptCargado;
}

// Botón "Continuar con Google" (Google Identity Services) — crea la cuenta
// sola la primera vez que alguien entra con Google (ver POST /auth/google
// en el backend), sin pedir contraseña. Sin VITE_GOOGLE_CLIENT_ID cargado
// (todavía no se creó el cliente OAuth en Google Cloud Console — típico en
// desarrollo) el botón no se dibuja, en vez de romper la pantalla de login.
export default function BotonGoogle({ onCredential, onError }) {
  const contenedorRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !contenedorRef.current) return undefined;
    let cancelado = false;
    cargarScriptGoogle()
      .then(() => {
        if (cancelado || !window.google || !contenedorRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (respuesta) => onCredential(respuesta.credential),
        });
        window.google.accounts.id.renderButton(contenedorRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      })
      .catch(() => onError?.('No se pudo cargar el botón de Google'));
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;
  return (
    <>
      <div className="separador-o"><span>o</span></div>
      <div ref={contenedorRef} style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }} />
    </>
  );
}
