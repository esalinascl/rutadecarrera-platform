/**
 * Herramientas del menú principal («Herramientas»).
 *
 * Fuente única del menú: para sumar una herramienta, agregarla AL FINAL de la
 * lista (el DISC va primero por decisión de Eduardo, SPEC web de la Red R4.1).
 * `externa: true` indica un enlace a otro sitio (se abre con la ruta absoluta).
 * `soloMiembros: true` indica que vive en el área de miembros (`/red`) y pide login.
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
  /** true cuando solo la pueden usar los miembros de la Red. */
  readonly soloMiembros: boolean;
}

/** Dirección pública del test DISC (sitio propio, repo del hilo DISC; no se toca desde aquí). */
export const URL_TEST_DISC = 'https://disc.rutadecarrera.com';

export const HERRAMIENTAS: readonly Herramienta[] = [
  {
    nombre: 'Test DISC',
    href: '/red/herramientas/disc',
    descripcion: 'Aplica el test DISC a tus clientes con tu código personal.',
    externa: false,
    soloMiembros: true,
  },
  {
    nombre: 'Rueda de la Vida',
    href: '/ruedadelavida',
    descripcion: 'Puntúa de 1 a 10 cada área de tu vida y descarga tu rueda.',
    externa: false,
    soloMiembros: false,
  },
];
