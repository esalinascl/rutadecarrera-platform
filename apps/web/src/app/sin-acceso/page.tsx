export const metadata = { title: 'Solo para miembros — Ruta de Carrera' };

/** Página amable para quien tiene sesión pero no es miembro de la Red (R3.2). */
export default function PaginaSinAcceso() {
  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }}>
      <h1>Esta área es solo para miembros de la Red</h1>
      <p>
        Tu cuenta todavía no está habilitada como miembro de la Red Ruta de Carrera. Si eres consultor o
        coach de carrera y quieres sumarte, cuéntanos tu interés.
      </p>
      <p>
        <a href="https://tinyurl.com/red-rutadecarrera">Quiero ser parte de la red</a>
      </p>
      <p>
        <a href="/">Volver al inicio</a>
      </p>
    </main>
  );
}
