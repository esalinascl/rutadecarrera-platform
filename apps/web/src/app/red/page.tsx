import { HERRAMIENTAS } from '../../lib/herramientas';
import { exigirMiembro } from '../../lib/red/exigir-miembro';

// Depende de la sesión del usuario: nunca se genera al compilar.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Área de miembros — Ruta de Carrera' };

/** Portada del área de miembros de la Red (SPEC web de la Red, R3.4 y R3.5). */
export default async function PaginaRed() {
  const miembro = await exigirMiembro('/red');

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
      <h1>Hola, {miembro.nombre}</h1>
      <p>Bienvenida y bienvenido al área de miembros de la Red Ruta de Carrera.</p>

      <h2>Tus herramientas</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {HERRAMIENTAS.map((h) => (
          <li key={h.href} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
            <a href={h.href}>
              <strong>{h.nombre}</strong>
            </a>
            <br />
            <span>{h.descripcion}</span>
          </li>
        ))}
      </ul>

      <form action="/auth/salir" method="post" style={{ marginTop: 32 }}>
        <button type="submit">Salir</button>
      </form>
    </main>
  );
}
