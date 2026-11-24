/**
 * @file lib/red/supabase-miembro.ts
 * @description Conecta `lib/red/miembro.ts` con Supabase usando la sesión del
 * usuario (clave pública + cookies): RLS decide qué filas puede leer.
 * Solo para Server Components y Route Handlers.
 */

import { crearClienteServidor } from '../supabase/servidor';
import { obtenerUsuarioId } from '../auth/usuario-sesion';
import type { DependenciasMiembro } from './miembro';

export async function crearDependenciasMiembro(): Promise<DependenciasMiembro> {
  const supabase = await crearClienteServidor();
  return {
    obtenerUsuarioId,
    leerUsuario: async (id) => {
      const { data, error } = await supabase.from('usuarios').select('nombre, rol').eq('id', id).maybeSingle();
      return { data, error };
    },
    leerCodigo: async (id) => {
      const { data, error } = await supabase.from('codigos_disc').select('codigo').eq('usuario_id', id).maybeSingle();
      return { data, error };
    },
  };
}
