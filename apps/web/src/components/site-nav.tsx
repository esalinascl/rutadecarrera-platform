import { HERRAMIENTAS } from '../lib/herramientas';

/**
 * Menú principal del sitio. «Herramientas» es un desplegable sin JavaScript
 * (elemento nativo `<details>`), por lo que funciona también con teclado
 * y en lectores de pantalla.
 */
export function SiteNav() {
  return (
    <nav aria-label="Menú principal" style={{ borderBottom: '1px solid #e5e5e5', padding: '12px 24px' }}>
      <ul
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        <li>
          <a href="/">Ruta de Carrera</a>
        </li>
        <li>
          <details>
            <summary style={{ cursor: 'pointer' }}>Herramientas</summary>
            <ul style={{ listStyle: 'none', padding: '8px 0 0', margin: 0 }}>
              {HERRAMIENTAS.map((h) => (
                <li key={h.href} style={{ padding: '4px 0' }}>
                  <a href={h.href}>{h.nombre}</a>
                </li>
              ))}
            </ul>
          </details>
        </li>
      </ul>
    </nav>
  );
}
