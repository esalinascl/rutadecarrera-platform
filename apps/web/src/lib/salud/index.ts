/**
 * @file lib/salud/index.ts
 * @description Punto de entrada de la salud de la base: el verificador que usa `GET /api/health`.
 */

import { consultarSupabase } from './consulta-supabase';
import { crearVerificadorDeSalud } from './verificar-base';

export { crearVerificadorDeSalud } from './verificar-base';
export type { EstadoSalud, ResultadoSalud } from './verificar-base';

/** Verificador compartido por la ruta (una caché por instancia del servidor). */
export const verificarSalud = crearVerificadorDeSalud({ consulta: consultarSupabase });
