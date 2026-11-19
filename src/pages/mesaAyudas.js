import { useEffect, useRef } from 'react';

// Bocina de la Mesa: un "buzzer" corto generado en el navegador (no hace
// falta ningún archivo de audio). Si el navegador lo bloquea, no pasa nada.
let audio;
export function sonarBocina(duracion = 0.9, frecuencia = 330) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = frecuencia;
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    vol.gain.setValueAtTime(0.3, t + duracion - 0.06);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(vol).connect(audio.destination);
    osc.start(t);
    osc.stop(t + duracion);
  } catch { /* sin audio: la Mesa sigue igual */ }
}

// Atajos de teclado de la Mesa (lo que se muestra en la ayuda).
export const ATAJOS_MESA = [
  ['Espacio', 'Iniciar / pausar el reloj'],
  ['1 · 2 · 3', 'Sumar puntos al equipo activo'],
  ['F', 'Falta personal'],
  ['T', 'Tiempo muerto'],
  ['L · V', 'Elegir local / visita'],
  ['Ctrl+Z', 'Deshacer la última jugada'],
];

// Escucha el teclado solo cuando `activo()` da true (la Mesa está a la
// vista) y nunca mientras se escribe en un campo.
export function useAtajosMesa(activo, acciones) {
  const ref = useRef({ activo, acciones });
  ref.current = { activo, acciones };
  useEffect(() => {
    const alPresionar = (e) => {
      const { activo: estaActivo, acciones: a } = ref.current;
      if (!estaActivo()) return;
      const t = e.target;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); a.deshacer(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const accion = {
        ' ': a.reloj, 1: () => a.puntos(1), 2: () => a.puntos(2), 3: () => a.puntos(3),
        f: a.falta, t: a.timeout, l: () => a.equipo('local'), v: () => a.equipo('visita'),
      }[k];
      if (!accion) return;
      e.preventDefault();
      accion();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, []);
}
