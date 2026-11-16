/**
 * @file lib/supabase/config.ts
 * @description Configuración PÚBLICA de Supabase para el flujo con sesión de
 * usuario (TASK 9). Solo usa la clave anónima/publicable: nunca la
 * `service_role` (esa vive aislada en @rcp/shared/db, solo servidor).
 */

export interface ConfigPublicaSupabase {
  url: string;
  anonKey: string;
  /** URL pública de la app, sin barra final (base de los enlaces del Magic Link). */
  appUrl: string;
}

/** `true` si la clave es la nueva `sb_secret_…` o un JWT legado con `role: service_role`. */
function esClaveSecreta(clave: string): boolean {
  if (clave.startsWith('sb_secret_')) return true;
  const partes = clave.split('.');
  if (partes.length !== 3) return false;
  try {
    const carga = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf-8')) as { role?: unknown };
    return carga.role === 'service_role';
  } catch {
    return false;
  }
}

/**
 * Lee la configuración desde variables de entorno.
 * @throws Error en español si falta alguna variable o si la clave es secreta.
 */
export function leerConfigPublica(
  env: Record<string, string | undefined> = process.env,
): ConfigPublicaSupabase {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = env.NEXT_PUBLIC_APP_URL;

  for (const [nombre, valor] of [
    ['NEXT_PUBLIC_SUPABASE_URL', url],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey],
    ['NEXT_PUBLIC_APP_URL', appUrl],
  ] as const) {
    if (!valor) {
      throw new Error(`Falta la variable de entorno ${nombre} (autenticación con Magic Link).`);
    }
  }

  // Defensa: una clave secreta con prefijo NEXT_PUBLIC_ se publicaría en el navegador.
  if (esClaveSecreta(anonKey!)) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY contiene una clave secreta: usa la clave publicable (anon).',
    );
  }

  return { url: url!, anonKey: anonKey!, appUrl: appUrl!.replace(/\/+$/, '') };
}
