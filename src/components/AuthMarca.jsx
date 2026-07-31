// Encabezado compartido de las pantallas de acceso (Login/Registro/Recuperar)
// — mismo ícono y nombre siempre, para que las cuatro pantallas se sientan
// como una sola hoja de ingreso, no como formularios sueltos.
export default function AuthMarca() {
  return (
    <div className="auth-marca">
      <span className="auth-marca-icono">🏀</span>
      <span className="auth-marca-nombre">App-overlays</span>
    </div>
  );
}
