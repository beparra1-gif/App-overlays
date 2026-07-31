// Envío de emails transaccionales (recuperar contraseña) vía la API HTTP de
// Resend — un solo fetch, sin SDK aparte (Node ya trae fetch nativo). Si
// todavía no hay RESEND_API_KEY configurada (antes de crear la cuenta de
// Resend, o en desarrollo) el enlace se imprime en la consola del servidor
// en vez de fallar — así el flujo de "olvidé mi contraseña" se puede probar
// de punta a punta sin depender de una cuenta de email real; en producción
// alcanza con cargar la variable de entorno para que empiece a enviar de
// verdad, sin tocar código.
export async function enviarEmail({ para, asunto, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.EMAIL_FROM || 'App-overlays <onboarding@resend.dev>';

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY no configurada — se muestra acá en vez de enviarse de verdad.\nPara: ${para}\nAsunto: ${asunto}\n${html}`);
    return { simulado: true };
  }

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: remitente, to: para, subject: asunto, html }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`No se pudo enviar el email (${respuesta.status}): ${detalle}`);
  }
  return respuesta.json();
}
