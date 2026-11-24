/**
 * @file lib/red/exigir-miembro.ts
 * @description Segunda barrera del área de miembros (la primera es el proxy):
 * cada página de `/red` la llama y, si quien entra no es miembro, lo saca.
 * `cache` evita repetir la consulta dentro de una misma petición.
 */

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { RUTA_SIN_ACCESO } from '../auth/acceso';
import { leerMiembro, type EstadoMiembro } from './miembro';
import { crearDependenciasMiembro } from './supabase-miembro';

type Miembro = Extract<EstadoMiembro, { estado: 'miembro' }>;

export const exigirMiembro = cache(async (rutaActual: string): Promise<Miembro> => {
  const miembro = await leerMiembro(await crearDependenciasMiembro());
  if (miembro.estado === 'sin-sesion') redirect(`/auth/login?siguiente=${encodeURIComponent(rutaActual)}`);
  if (miembro.estado === 'no-miembro') redirect(RUTA_SIN_ACCESO);
  return miembro;
});
