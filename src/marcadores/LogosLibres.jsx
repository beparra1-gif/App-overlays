import { useRef } from 'react';

// Logos "libres" (competencia, torneo, liga, lo que haga falta) — a
// diferencia de LogoFlotante (el logo del equipo, anclado a un puñado de
// posiciones fijas alrededor del tablero), acá cada logo tiene su propia
// posición y tamaño en % del lienzo 1920×1080, sin ataduras a ningún otro
// elemento — se puede poner en cualquier esquina o zona de la pantalla.
// Mismo truco de apilado que el resto (LogoFlotante/TituloMarcador): un
// hermano position:fixed;inset:0 más, nunca toca las 25 plantillas.
//
// `editable` (solo en el panel de admin, pestaña "Logos libres"): activa el
// arrastre con el puntero — mueve/toca y arrastra el logo directo sobre la
// vista previa para reposicionarlo; el tamaño/opacidad se ajustan con los
// controles de la lista, no acá (un handle de resize sobre una imagen chica
// es difícil de tocar bien en tablet). `contenedorRef` es el lienzo de
// referencia (1920×1080 ya escalado) contra el que se calculan los % — el
// cálculo usa getBoundingClientRect(), así que funciona igual sin importar
// el zoom/escala que tenga la vista previa en ese momento.
export default function LogosLibres({ config, editable = false, onArrastrar, contenedorRef }) {
  const lista = Array.isArray(config?.logosLibres) ? config.logosLibres : [];
  const arrastrandoId = useRef(null);

  if (lista.length === 0) return null;

  const mover = (e) => {
    if (arrastrandoId.current == null || !contenedorRef?.current) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const xPercent = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    onArrastrar?.(arrastrandoId.current, xPercent, yPercent);
  };
  const soltar = () => { arrastrandoId.current = null; };

  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: editable ? 'auto' : 'none' }}
      onPointerMove={editable ? mover : undefined}
      onPointerUp={editable ? soltar : undefined}
      onPointerLeave={editable ? soltar : undefined}
    >
      {lista.map((logo) => (
        <img
          key={logo.id}
          className="logo-libre-img"
          src={logo.logoUrl}
          alt=""
          draggable={false}
          onPointerDown={editable ? (e) => { e.currentTarget.setPointerCapture(e.pointerId); arrastrandoId.current = logo.id; } : undefined}
          style={{
            position: 'absolute',
            left: `${Number.isFinite(logo.xPercent) ? logo.xPercent : 50}%`,
            top: `${Number.isFinite(logo.yPercent) ? logo.yPercent : 50}%`,
            width: `${Number.isFinite(logo.anchoPercent) ? logo.anchoPercent : 15}%`,
            transform: 'translate(-50%, -50%)',
            opacity: (Number.isFinite(logo.opacidad) ? logo.opacidad : 100) / 100,
            pointerEvents: editable ? 'auto' : 'none',
            cursor: editable ? 'grab' : 'default',
            touchAction: editable ? 'none' : 'auto',
            outline: editable ? '2px dashed rgba(10,132,255,.85)' : 'none',
            outlineOffset: 3,
            userSelect: 'none',
          }}
        />
      ))}
    </div>
  );
}
