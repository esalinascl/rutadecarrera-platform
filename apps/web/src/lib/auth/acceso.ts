/**
 * @file lib/auth/acceso.ts
 * @description Reglas de acceso por ruta y rol (TASK 9). Funciones puras,
 * sin dependencias de Next ni de Supabase, para poder probarlas a fondo.
 * El proxy (src/proxy.ts) solo traduce la decisión a una respuesta HTTP.
 */

/** Roles de `usuarios.rol` (ADR 003). `null` = sin sesión. */
export type Rol = 'cliente' | 'consultor' | 'admin';

export type DecisionAcceso =
  | { tipo: 'permitir' }
  | { tipo: 'redirigir'; destino: string }
  | { tipo: 'rechazar'; estado: 401 | 403 };

export interface EntradaAcceso {
  pathname: string;
  rol: Rol | null;
}

const RUTA_LOGIN = '/auth/login';
const RUTA_POR_DEFECTO = '/dashboard';

/** `true` si `pathname` es `base` o cuelga de `base/` (no confunde `/dashboardx`). */
function esRuta(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

const RUTAS_CONSULTOR_PAGINA = '/dashboard/consultor';
const RUTAS_CONSULTOR_API = '/api/consultor';
const RUTAS_API_PROTEGIDAS = ['/api/chat', RUTAS_CONSULTOR_API];

/**
 * Decide qué hacer con una petición según la ruta y el rol de la sesión.
 *
 * - `/dashboard/*` exige sesión (sin ella: redirige al login).
 * - Rutas de consultor exigen rol consultor o admin (cliente: 403).
 * - Las APIs protegidas responden 401 sin sesión (no redirigen).
 * - Todo lo demás es público.
 */
export function decidirAcceso({ pathname, rol }: EntradaAcceso): DecisionAcceso {
  const esConsultor = esRuta(pathname, RUTAS_CONSULTOR_PAGINA) || esRuta(pathname, RUTAS_CONSULTOR_API);
  const esApiProtegida = RUTAS_API_PROTEGIDAS.some((base) => esRuta(pathname, base));
  const esPaginaProtegida = esRuta(pathname, RUTA_POR_DEFECTO);

  if (!esApiProtegida && !esPaginaProtegida) {
    return { tipo: 'permitir' };
  }

  if (rol === null) {
    if (esApiProtegida) {
      return { tipo: 'rechazar', estado: 401 };
    }
    return {
      tipo: 'redirigir',
      destino: `${RUTA_LOGIN}?siguiente=${encodeURIComponent(pathname)}`,
    };
  }

  if (esConsultor && rol !== 'consultor' && rol !== 'admin') {
    return { tipo: 'rechazar', estado: 403 };
  }

  return { tipo: 'permitir' };
}

/**
 * Valida el parámetro `siguiente` del login para evitar redirecciones abiertas:
 * solo se aceptan rutas internas (`/algo`), nunca URLs externas ni `//host`.
 */
export function rutaSiguienteSegura(valor: string | null | undefined): string {
  if (typeof valor !== 'string' || valor.length === 0) return RUTA_POR_DEFECTO;
  if (!valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\')) {
    return RUTA_POR_DEFECTO;
  }
  return valor;
}
