/**
 * @file lib/salud/errores.ts
 * @description Errores propios de la verificación de salud de la base (SPEC — health-db).
 *
 * Los mensajes son FIJOS a propósito: nunca llevan texto que venga de Supabase, porque podría
 * traer direcciones, nombres de proyecto o fragmentos de claves. Lo único que se conserva de
 * la base es el código de error (por ejemplo, `PGRST205`), que no contiene datos sensibles.
 */

/** Faltan `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` en el entorno del servidor. */
export class ErrorConfiguracionSalud extends Error {
  constructor() {
    super('Falta la configuración de Supabase en el servidor');
    this.name = 'ErrorConfiguracionSalud';
  }
}

/** La base respondió con un error (tabla ausente, permisos, proyecto pausado, etc.). */
export class ErrorBaseDeDatosSalud extends Error {
  constructor(readonly codigo?: string) {
    super('La base de datos respondió con un error');
    this.name = 'ErrorBaseDeDatosSalud';
  }
}
