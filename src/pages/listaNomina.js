// Lista pegada (de Excel, WhatsApp, etc.) → jugadoras: una por línea, con
// el dorsal adelante ("7 Ana Torres", "#7 - Ana", "7<TAB>Ana") o atrás
// ("Ana Torres 7"), o solo el nombre.
export function parsearListaNomina(texto) {
  return String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    let m = l.match(/^#?\s*(\d{1,3})\s*[-.,:;)\t|]*\s*(.*)$/);
    if (m) return { dorsal: m[1], nombre: m[2].trim() };
    m = l.match(/^(.*?)[\s,;\t|#-]+(\d{1,3})$/);
    if (m) return { dorsal: m[2], nombre: m[1].trim() };
    return { dorsal: null, nombre: l };
  });
}
