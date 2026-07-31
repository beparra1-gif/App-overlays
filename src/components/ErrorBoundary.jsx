import { Component } from 'react';

// Cualquier capa de la escena pública (Marcador, Nómina, Estadísticas,
// Anuncios, Logos libres) que tire una excepción al renderizar NO debe
// tumbar la fuente de OBS entera — sin esto, un dato mal formado en UNA sola
// capa dejaba la pantalla completa en blanco durante la transmisión en vivo,
// aunque las otras tres capas estuvieran perfectamente bien. Cada capa se
// envuelve por separado (ver EscenaPublica.jsx): si una revienta, esa
// desaparece sola y las demás siguen en pantalla.
export default class ErrorBoundary extends Component {
  state = { rompio: false };

  static getDerivedStateFromError() {
    return { rompio: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.rompio) return null;
    return this.props.children;
  }
}
