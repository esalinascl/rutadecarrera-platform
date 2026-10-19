/**
 * Herramientas del menú principal («Herramientas»).
 *
 * Fuente única del menú: para sumar una herramienta, agregarla aquí.
 * `externa: true` indica un enlace a otro sitio (se abre con la ruta absoluta).
 */
export interface Herramienta {
  /** Nombre visible en el menú. */
  readonly nombre: string;
  /** Ruta interna (`/algo`) o URL absoluta si `externa` es true. */
  readonly href: string;
  /** Descripción corta, usada como texto de apoyo. */
  readonly descripcion: string;
  /** true cuando vive fuera de este sitio (otro subdominio). */
  readonly externa: boolean;
}

export const HERRAMIENTAS: readonly Herramienta[] = [
  {
    nombre: 'Rueda de la Vida',
    href: '/ruedadelavida',
    descripcion: 'Puntúa de 1 a 10 cada área de tu vida y descarga tu rueda.',
    externa: false,
  },
  {
    // Sigue como sitio independiente hasta la etapa M5 del ADR 002.
    nombre: 'Test DISC',
    href: 'https://disc.rutadecarrera.com',
    descripcion: 'Descubre tu perfil de comportamiento.',
    externa: true,
  },
];
