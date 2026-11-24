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
/** Área de miembros de la Red (SPEC web de la Red, P1 = `/red`). */
export const RUTA_RED = '/red';
/** Página «solo para miembros» para quien tiene sesión pero no es miembro (R3.2). */
export const RUTA_SIN_ACCESO = '/sin-acceso';
const RUTA_POR_DEFECTO = RUTA_RED;

/** `true` si `pathname` es `base` o cuelga de `base/` (no confunde `/dashboardx`). */
export function esRuta(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

const RUTA_DASHBOARD = '/dashboard';
const RUTAS_CONSULTOR_PAGINA = '/dashboard/consultor';
const RUTAS_CONSULTOR_API = '/api/consultor';
const RUTAS_API_PROTEGIDAS = ['/api/chat', RUTAS_CONSULTOR_API];

/** Rutas donde importa el rol (el proxy solo lo consulta aquí). */
export function requiereRol(pathname: string): boolean {
  return esRuta(pathname, RUTA_RED) || esRuta(pathname, RUTAS_CONSULTOR_API);
}

function esMiembro(rol: Rol | null): boolean {
  return rol === 'consultor' || rol === 'admin';
}

/**
 * Decide qué hacer con una petición según la ruta y el rol de la sesión.
 *
 * - `/red/*` (área de miembros) exige sesión y rol consultor o admin; sin
 *   sesión va al login y un cliente va a `/sin-acceso`.
 * - `/dashboard` y `/dashboard/consultor/*` ya no tienen página: con sesión
 *   llevan a `/red` (antes daban 404).
 * - El resto de `/dashboard/*` exige sesión (sin ella: redirige al login).
 * - `/api/consultor/*` exige rol consultor o admin (cliente: 403).
 * - Las APIs protegidas responden 401 sin sesión (no redirigen).
 * - Todo lo demás es público.
 */
export function decidirAcceso({ pathname, rol }: EntradaAcceso): DecisionAcceso {
  const esArea = esRuta(pathname, RUTA_RED);
  const esApiProtegida = RUTAS_API_PROTEGIDAS.some((base) => esRuta(pathname, base));
  const esPaginaProtegida = esRuta(pathname, RUTA_DASHBOARD) || esArea;

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

  if (pathname === RUTA_DASHBOARD || esRuta(pathname, RUTAS_CONSULTOR_PAGINA)) {
    return { tipo: 'redirigir', destino: RUTA_RED };
  }

  if (esArea && !esMiembro(rol)) {
    return { tipo: 'redirigir', destino: RUTA_SIN_ACCESO };
  }

  if (esRuta(pathname, RUTAS_CONSULTOR_API) && !esMiembro(rol)) {
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
