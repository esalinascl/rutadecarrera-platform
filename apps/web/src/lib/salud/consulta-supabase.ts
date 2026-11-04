/**
 * @file lib/salud/consulta-supabase.ts
 * @description Consulta mínima a Supabase para comprobar que la base responde (SPEC — health-db).
 *
 * SEGURIDAD:
 * - Solo servidor: usa la service role (`SUPABASE_SERVICE_ROLE_KEY`) a través de `@rcp/shared/db`,
 *   que se niega a ejecutarse en el navegador.
 * - La consulta es FIJA y de solo lectura: `select id` con `limit(0)` sobre `usuarios` (la base
 *   la ejecuta y comprueba que la tabla y los permisos existen, pero no devuelve ninguna fila).
 *   No recibe ningún dato del cliente.
 * - NO usa `head: true`: con HEAD, postgrest-js trata un 404 sin cuerpo (tabla inexistente) como
 *   éxito y la base parecería sana aunque faltara el esquema.
 * - Desactiva los reintentos internos de postgrest-js (`retry(false)`): con ellos, una base
 *   inalcanzable tardaba hasta el tiempo límite (esperas de 1, 2 y 4 s) y se clasificaba mal como
 *   timeout. Una sonda debe decir la verdad al instante; el reintento lo hace Monitoring.
 * - Los errores se convierten a errores propios con mensaje fijo: el texto original de Supabase
 *   puede traer direcciones o nombres internos y nunca debe llegar al log ni a la respuesta.
 */

import { crearClienteSupabase, leerConfigSupabase, type SupabaseServerConfig } from '@rcp/shared/db';
import { ErrorBaseDeDatosSalud, ErrorConfiguracionSalud } from './errores';

/**
 * Consulta la base. Resuelve si responde; rechaza con `ErrorConfiguracionSalud` si faltan las
 * variables de entorno o con `ErrorBaseDeDatosSalud` si Supabase devuelve un error.
 *
 * @param senal Señal de cancelación: al abortarse (tiempo límite) se corta la petición en curso.
 */
export async function consultarSupabase(senal: AbortSignal): Promise<void> {
  let configuracion: SupabaseServerConfig;
  try {
    configuracion = leerConfigSupabase();
  } catch {
    throw new ErrorConfiguracionSalud();
  }

  const cliente = crearClienteSupabase(configuracion);
  const { error } = await cliente
    .from('usuarios')
    .select('id')
    .limit(0)
    .abortSignal(senal)
    .retry(false);

  if (error) {
    throw new ErrorBaseDeDatosSalud(error.code || undefined);
  }
}
