/**
 * @file lib/supabase/servidor.ts
 * @description Cliente Supabase CON SESIÓN DE USUARIO para Route Handlers y
 * Server Components (TASK 9, ADR 003). Usa la clave anónima: lo que el
 * usuario puede ver o escribir lo decide RLS, no el código.
 *
 * NO confundir con `@rcp/shared/db` (service_role, ignora RLS, solo para
 * créditos, pagos y administración).
 */

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerConfigPublica } from './config';
import { opcionesCookie } from './cookies';

export async function crearClienteServidor(): Promise<SupabaseClient> {
  const config = leerConfigPublica();
  const almacen = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookieOptions: opcionesCookie(),
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (aEscribir) => {
        try {
          for (const { name, value, options } of aEscribir) {
            almacen.set(name, value, options);
          }
        } catch {
          // Desde un Server Component no se pueden escribir cookies: el proxy
          // ya renueva la sesión en cada petición, así que se ignora.
        }
      },
    },
  });
}
