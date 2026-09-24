/**
 * @file src/index.ts
 * @description Punto de entrada del paquete shared
 * Exporta todos los tipos, schemas y utilidades
 */

// Tipos principales
export * from './types';

// Contratos de la capa de datos (solo tipos y lista de columnas).
// El cliente de servidor se importa aparte: `@rcp/shared/db`.
export * from './db/schema';

// Utilidades y validación
export * from './utils/validation';
export * from './utils/gemini';
export * from './utils/index';

// Re-export de Zod para acceso directo
export { z } from 'zod';
