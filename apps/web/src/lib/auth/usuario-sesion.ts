/**
 * @file lib/auth/usuario-sesion.ts
 * @description Obtiene el usuario autenticado desde la sesión (cookies httpOnly).
 * `auth.getUser()` valida el token contra Supabase Auth: no se confía en la
 * cookie sin verificarla.
 */

import { crearClienteServidor } from '../supabase/servidor';

/** UUID del usuario con sesión válida, o `null` si no hay sesión. */
export async function obtenerUsuarioId(): Promise<string | null> {
  try {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch (error) {
    console.error('No se pudo leer la sesión del usuario:', error);
    return null;
  }
}
