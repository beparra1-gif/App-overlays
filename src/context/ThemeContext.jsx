import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const CLAVE_TEMA = 'app_overlays_tema';

const temaPreferidoDelSistema = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem(CLAVE_TEMA) || temaPreferidoDelSistema());

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem(CLAVE_TEMA, tema);
  }, [tema]);

  const alternarTema = () => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro'));

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const contexto = useContext(ThemeContext);
  if (!contexto) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return contexto;
}
