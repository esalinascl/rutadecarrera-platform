/**
 * Base de datos de pruebas que emula lo mínimo de Supabase para probar RLS.
 *
 * Usa PGlite (Postgres real compilado a WASM, en memoria, sin Docker). Lo que
 * se prueba es el SQL REAL de las migraciones (se leen del disco), no una copia.
 *
 * LO QUE ES EMULACIÓN (y por eso hay que verificar también en Supabase staging):
 *   - Los roles `anon`, `authenticated`, `service_role` y `supabase_auth_admin`.
 *   - El esquema `auth` con la tabla `auth.users` (cuyo dueño es
 *     `supabase_auth_admin`, no quien migra) y la función `auth.uid()`.
 *   - El rol `migrador`: emula a `postgres` en Supabase. NO es superusuario ni
 *     dueño de `auth.users`; solo tiene los privilegios que se le dan. Las
 *     migraciones corren con él, así se detectan errores de "debe ser dueño".
 *   - Los privilegios por defecto de Supabase sobre el esquema `public`
 *     (ALL para anon/authenticated/service_role): se emulan A PROPÓSITO para
 *     comprobar que la migración los recorta, en vez de depender de que la
 *     base de pruebas parta "cerrada".
 *
 * LO QUE NO ES EMULACIÓN: el motor de Postgres, las políticas RLS, los
 * GRANT/REVOKE, los triggers y las llaves foráneas.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

/**
 * Roles con los que se ejecutan consultas: los tres de la API (según la llave
 * usada) y `supabase_auth_admin`, que es quien inserta/actualiza `auth.users`
 * al registrarse o cambiar el email (y por tanto quien dispara los triggers).
 */
export type RolBd = 'anon' | 'authenticated' | 'service_role' | 'supabase_auth_admin';

/** Identidad con la que se ejecuta una consulta (equivale a un JWT). */
export interface Identidad {
  rol: RolBd;
  /** `sub` del JWT; solo aplica a `authenticated`. */
  uid?: string;
}

const SQL_SUPABASE_MINIMO = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE ROLE supabase_auth_admin NOLOGIN;
  CREATE ROLE migrador NOLOGIN;

  CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
  CREATE TABLE auth.users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              VARCHAR(255),
    raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb
  );
  ALTER TABLE auth.users OWNER TO supabase_auth_admin;

  -- Igual que Supabase: lee el "sub" del JWT que PostgREST deja en la sesión.
  CREATE FUNCTION auth.uid() RETURNS UUID
    LANGUAGE sql STABLE
    AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA auth TO migrador;
  GRANT USAGE, CREATE ON SCHEMA public TO migrador, supabase_auth_admin;
  GRANT SELECT ON auth.users TO service_role;
  -- "postgres" en Supabase tiene privilegios sobre auth.users sin ser su dueño.
  GRANT ALL ON auth.users TO migrador;

  -- Privilegios por defecto de Supabase: toda tabla/función/secuencia nueva de
  -- "public" que cree quien migra nace abierta a los tres roles. La migración
  -- debe cerrar lo que corresponda.
  ALTER DEFAULT PRIVILEGES FOR ROLE migrador IN SCHEMA public
    GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE migrador IN SCHEMA public
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE migrador IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

/** Lee una migración real del paquete (src/db/migrations). */
export function leerMigracion(nombre: string): string {
  const ruta = fileURLToPath(new URL(`../../db/migrations/${nombre}`, import.meta.url));
  return readFileSync(ruta, 'utf8');
}

/**
 * Aplica un SQL (una migración) como `migrador` y vuelve siempre al
 * superusuario, aunque falle.
 */
export async function aplicarComoMigrador(db: PGlite, sql: string): Promise<void> {
  await db.exec('SET ROLE migrador');
  try {
    await db.exec(sql);
  } finally {
    // Si la migración falló a mitad, la transacción queda abortada: se cierra.
    await db.exec('ROLLBACK').catch(() => undefined);
    await db.exec('RESET ROLE');
  }
}

/**
 * Crea una base en memoria con el Supabase mínimo y aplica las migraciones
 * indicadas, en orden, con el rol `migrador` (no superusuario).
 */
export async function crearBaseConMigraciones(migraciones: string[]): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SQL_SUPABASE_MINIMO);
  for (const nombre of migraciones) {
    await aplicarComoMigrador(db, leerMigracion(nombre));
  }
  return db;
}

/**
 * Ejecuta una consulta con la identidad dada y SIEMPRE vuelve al superusuario
 * al terminar (aunque falle), para no contaminar el siguiente paso del test.
 */
export async function comoIdentidad<T extends Record<string, unknown> = Record<string, unknown>>(
  db: PGlite,
  identidad: Identidad,
  sql: string,
  parametros: unknown[] = []
): Promise<{ rows: T[]; affectedRows?: number }> {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [identidad.uid ?? '']);
  await db.exec(`SET ROLE ${identidad.rol}`);
  try {
    const resultado = await db.query<T>(sql, parametros);
    return { rows: resultado.rows, affectedRows: resultado.affectedRows };
  } finally {
    await db.exec('RESET ROLE');
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
}
