/**
 * @file lib/red/miembro.ts
 * @description Quién es el miembro con sesión y cuál es su código DISC
 * (SPEC «Web de la Red y área de miembros» v1.0, R3.3, R3.4, R5.1 y R5.3).
 *
 * Lógica pura con dependencias inyectadas; la conexión con Supabase está en
 * `lib/red/supabase-miembro.ts`. Lo que cada usuario puede leer lo decide RLS.
 */

/** Respuesta mínima de una consulta de Supabase. */
export interface RespuestaConsulta<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface DependenciasMiembro {
  /** UUID del usuario con sesión válida, o `null`. */
  obtenerUsuarioId: () => Promise<string | null>;
  leerUsuario: (id: string) => Promise<RespuestaConsulta<{ nombre: string | null; rol: string }>>;
  leerCodigo: (id: string) => Promise<RespuestaConsulta<{ codigo: string }>>;
}

export type EstadoMiembro =
  | { estado: 'sin-sesion' }
  | { estado: 'no-miembro' }
  | { estado: 'miembro'; id: string; nombre: string; rol: 'consultor' | 'admin' };

export type EstadoCodigoDisc = { estado: 'asignado'; codigo: string } | { estado: 'sin-codigo' } | { estado: 'error' };

const NOMBRE_GENERICO = 'miembro de la Red';

/** Lee al usuario con sesión. Ante cualquier duda, NO es miembro (falla cerrada). */
export async function leerMiembro(deps: DependenciasMiembro): Promise<EstadoMiembro> {
  const id = await deps.obtenerUsuarioId();
  if (id === null) return { estado: 'sin-sesion' };

  const { data, error } = await deps.leerUsuario(id);
  if (error) {
    console.error('No se pudo leer el usuario del área de miembros:', error.message);
    return { estado: 'no-miembro' };
  }
  if (!data || (data.rol !== 'consultor' && data.rol !== 'admin')) {
    return { estado: 'no-miembro' };
  }

  const nombre = data.nombre?.trim() ? data.nombre.trim() : NOMBRE_GENERICO;
  return { estado: 'miembro', id, nombre, rol: data.rol };
}

/** Código DISC del miembro (RLS solo deja leer el propio). */
export async function leerCodigoDisc(deps: DependenciasMiembro, id: string): Promise<EstadoCodigoDisc> {
  const { data, error } = await deps.leerCodigo(id);
  if (error) {
    console.error('No se pudo leer el código DISC del miembro:', error.message);
    return { estado: 'error' };
  }
  const codigo = data?.codigo?.trim();
  return codigo ? { estado: 'asignado', codigo } : { estado: 'sin-codigo' };
}
