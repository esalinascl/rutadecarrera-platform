/**
 * @file db/index.ts
 * @description Capa de datos. SOLO SERVIDOR.
 *
 * Importar como `@rcp/shared/db` desde API routes o server actions.
 * No se re-exporta desde el índice principal del paquete para que un
 * componente de navegador no la importe por accidente.
 */

export * from './schema';
export * from './client';
