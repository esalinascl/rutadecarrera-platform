/**
 * Base de datos de pruebas que emula lo mínimo de Supabase para probar RLS.
 *
 * Usa PGlite (Postgres real compilado a WASM, en memoria, sin Docker). Lo que
 * se prueba es el SQL REAL de las migraciones (se leen del disco), no una copia.
 *
 * LO QUE ES EMULACIÓN (y por eso hay que verificar también en Supabase staging):
 *   - Los roles `anon`, `authenticated` y `service_role`.
 *   - El esquema `auth` con la tabla `auth.users` y la función `auth.uid()`.
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

/** Roles con los que Supabase ejecuta las consultas según la llave usada. */
export type RolBd = 'anon' | 'authenticated' | 'service_role';

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

  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              VARCHAR(255),
    raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb
  );

  -- Igual que Supabase: lee el "sub" del JWT que PostgREST deja en la sesión.
  CREATE FUNCTION auth.uid() RETURNS UUID
    LANGUAGE sql STABLE
    AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT SELECT ON auth.users TO service_role;

  -- Privilegios por defecto de Supabase: toda tabla nueva de "public" nace
  -- abierta a los tres roles. La migración debe cerrarlo.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO anon, authenticated, service_role;
`;

/** Lee una migración real del paquete (src/db/migrations). */
export function leerMigracion(nombre: string): string {
  const ruta = fileURLToPath(new URL(`../../db/migrations/${nombre}`, import.meta.url));
  return readFileSync(ruta, 'utf8');
}

/**
 * Crea una base en memoria con el Supabase mínimo y aplica las migraciones
 * indicadas, en orden, como superusuario (igual que el SQL Editor de Supabase).
 */
export async function crearBaseConMigraciones(migraciones: string[]): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SQL_SUPABASE_MINIMO);
  for (const nombre of migraciones) {
    await db.exec(leerMigracion(nombre));
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
