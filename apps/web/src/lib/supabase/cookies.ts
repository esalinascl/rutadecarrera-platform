/**
 * @file lib/supabase/cookies.ts
 * @description Opciones de la cookie de sesión (TASK 9).
 *
 * @supabase/ssr usa por defecto `httpOnly: false` y sin `Secure`: cualquier
 * script de la página (XSS) podría leer el token de renovación. Como la app no
 * usa el cliente de navegador de Supabase, la cookie puede ser httpOnly.
 */

export interface OpcionesCookie {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
}

/** `Secure` solo en producción: en localhost (http) el navegador la descartaría. */
export function opcionesCookie(entorno: string | undefined = process.env.NODE_ENV): OpcionesCookie {
  return { httpOnly: true, secure: entorno === 'production', sameSite: 'lax', path: '/' };
}
