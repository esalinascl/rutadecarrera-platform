/**
 * Tests de RLS y roles (TASK 8, AD-9 → A, AD-10 → B1).
 *
 * Se escriben ANTES que las políticas (TDD, mandato 3): deben fallar contra
 * una migración 003 vacía y pasar cuando 003 queda implementada.
 *
 * Corren el SQL real de 001 + 003 sobre Postgres en memoria (PGlite) con un
 * Supabase mínimo emulado (ver helpers/supabase-emulado.ts). Se repite la
 * verificación en Supabase staging antes de producción.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  comoIdentidad,
  crearBaseConMigraciones,
  leerMigracion,
  type Identidad,
} from './helpers/supabase-emulado';

const USUARIO_A = '11111111-1111-4111-8111-111111111111';
const USUARIO_B = '22222222-2222-4222-8222-222222222222';
const CONV_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONV_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const comoA: Identidad = { rol: 'authenticated', uid: USUARIO_A };
const anonimo: Identidad = { rol: 'anon' };
const sistema: Identidad = { rol: 'service_role' };
/** Rol `authenticated` pero sin sesión válida (JWT sin "sub"). */
const sinSesion: Identidad = { rol: 'authenticated' };

const MIGRACIONES = ['001_init_schema.sql', '003_auth_rls.sql'];
const TABLAS = ['usuarios', 'conversaciones', 'mensajes', 'analisis'] as const;

/** Mensajes de error de Postgres cuando RLS o los privilegios bloquean. */
const BLOQUEADO = /permission denied|row-level security|violates/i;

let db: PGlite;

/** Registra dos usuarios en auth.users (el trigger crea sus filas en `usuarios`). */
async function sembrarDatos(): Promise<void> {
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${USUARIO_A}', 'a@ejemplo.cl'),
      ('${USUARIO_B}', 'b@ejemplo.cl');

    INSERT INTO conversaciones (id, usuario_id, titulo) VALUES
      ('${CONV_A}', '${USUARIO_A}', 'Conversación de A'),
      ('${CONV_B}', '${USUARIO_B}', 'Conversación de B');

    INSERT INTO mensajes (conversacion_id, rol, contenido) VALUES
      ('${CONV_A}', 'user', 'mensaje de A'),
      ('${CONV_B}', 'user', 'mensaje de B');

    INSERT INTO analisis (usuario_id, tipo, resultado) VALUES
      ('${USUARIO_A}', 'empleabilidad', '{"puntaje": 1}'),
      ('${USUARIO_B}', 'empleabilidad', '{"puntaje": 2}');
  `);
}

beforeEach(async () => {
  db = await crearBaseConMigraciones(MIGRACIONES);
  await sembrarDatos();
});

afterEach(async () => {
  await db.close();
});

describe('Registro de usuarios (trigger sobre auth.users)', () => {
  it('crea la fila en `usuarios` con rol "cliente" al registrarse', async () => {
    const { rows } = await db.query<{ rol: string; email: string }>(
      `SELECT rol, email FROM usuarios WHERE id = $1`,
      [USUARIO_A]
    );
    expect(rows).toEqual([{ rol: 'cliente', email: 'a@ejemplo.cl' }]);
  });

  it('ignora un "rol" que venga en los metadatos del registro (no se puede auto-asignar)', async () => {
    const intruso = '33333333-3333-4333-8333-333333333333';
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'x@ejemplo.cl', $2)`,
      [intruso, JSON.stringify({ rol: 'admin', role: 'admin' })]
    );
    const { rows } = await db.query<{ rol: string }>(`SELECT rol FROM usuarios WHERE id = $1`, [
      intruso,
    ]);
    expect(rows[0]?.rol).toBe('cliente');
  });

  it('usa el nombre de los metadatos, o la parte local del email si no viene', async () => {
    const conNombre = '44444444-4444-4444-8444-444444444444';
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'ana@ejemplo.cl', $2)`,
      [conNombre, JSON.stringify({ nombre: 'Ana Pérez' })]
    );
    const { rows } = await db.query<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM usuarios WHERE id IN ($1, $2) ORDER BY email`,
      [USUARIO_A, conNombre]
    );
    expect(rows.find((r) => r.id === USUARIO_A)?.nombre).toBe('a');
    expect(rows.find((r) => r.id === conNombre)?.nombre).toBe('Ana Pérez');
  });

  it('borrar el usuario de auth borra su fila en `usuarios` y todo lo que cuelga de ella', async () => {
    await db.query(`DELETE FROM auth.users WHERE id = $1`, [USUARIO_A]);
    const { rows } = await db.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM usuarios WHERE id = $1)::int
            + (SELECT count(*) FROM conversaciones WHERE usuario_id = $1)::int AS n`,
      [USUARIO_A]
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('`usuarios.id` debe existir en auth.users (no hay usuarios fantasma)', async () => {
    await expect(
      db.query(`INSERT INTO usuarios (id, email, nombre) VALUES (gen_random_uuid(), 'f@e.cl', 'F')`)
    ).rejects.toThrow(/foreign key|violates/i);
  });
});

describe('Columna `rol` (AD-9 → A)', () => {
  it('solo admite cliente, consultor o admin', async () => {
    await expect(
      db.query(`UPDATE usuarios SET rol = 'superusuario' WHERE id = $1`, [USUARIO_A])
    ).rejects.toThrow(/check constraint|violates/i);
  });

  it('el valor por defecto es "cliente"', async () => {
    const { rows } = await db.query<{ column_default: string }>(
      `SELECT column_default FROM information_schema.columns
        WHERE table_name = 'usuarios' AND column_name = 'rol'`
    );
    expect(rows[0]?.column_default).toContain('cliente');
  });
});

describe('Aislamiento entre usuarios: lectura (AD-10 → B1)', () => {
  it('A solo ve su propia fila de `usuarios`', async () => {
    const { rows } = await comoIdentidad<{ id: string }>(db, comoA, `SELECT id FROM usuarios`);
    expect(rows.map((r) => r.id)).toEqual([USUARIO_A]);
  });

  it('A solo ve sus conversaciones', async () => {
    const { rows } = await comoIdentidad<{ id: string }>(db, comoA, `SELECT id FROM conversaciones`);
    expect(rows.map((r) => r.id)).toEqual([CONV_A]);
  });

  it('A solo ve los mensajes de sus conversaciones', async () => {
    const { rows } = await comoIdentidad<{ contenido: string }>(
      db,
      comoA,
      `SELECT contenido FROM mensajes`
    );
    expect(rows.map((r) => r.contenido)).toEqual(['mensaje de A']);
  });

  it('A solo ve sus análisis', async () => {
    const { rows } = await comoIdentidad<{ usuario_id: string }>(
      db,
      comoA,
      `SELECT usuario_id FROM analisis`
    );
    expect(rows.map((r) => r.usuario_id)).toEqual([USUARIO_A]);
  });

  it('A no puede leer la conversación de B ni pidiéndola por su id', async () => {
    const { rows } = await comoIdentidad(db, comoA, `SELECT * FROM conversaciones WHERE id = $1`, [
      CONV_B,
    ]);
    expect(rows).toHaveLength(0);
  });

  it.each(TABLAS)('un "authenticated" sin sesión válida no ve nada en %s', async (tabla) => {
    const { rows } = await comoIdentidad(db, sinSesion, `SELECT * FROM ${tabla}`);
    expect(rows).toHaveLength(0);
  });
});

describe('Aislamiento entre usuarios: escritura (AD-10 → B1)', () => {
  it('A puede crear una conversación propia', async () => {
    const { rows } = await comoIdentidad(
      db,
      comoA,
      `INSERT INTO conversaciones (usuario_id, titulo) VALUES ($1, 'nueva') RETURNING id`,
      [USUARIO_A]
    );
    expect(rows).toHaveLength(1);
  });

  it('A NO puede crear una conversación a nombre de B', async () => {
    await expect(
      comoIdentidad(db, comoA, `INSERT INTO conversaciones (usuario_id) VALUES ($1)`, [USUARIO_B])
    ).rejects.toThrow(BLOQUEADO);
  });

  it('A puede escribir un mensaje en su conversación', async () => {
    const { rows } = await comoIdentidad(
      db,
      comoA,
      `INSERT INTO mensajes (conversacion_id, rol, contenido) VALUES ($1, 'user', 'hola') RETURNING id`,
      [CONV_A]
    );
    expect(rows).toHaveLength(1);
  });

  it('A NO puede escribir un mensaje en la conversación de B', async () => {
    await expect(
      comoIdentidad(
        db,
        comoA,
        `INSERT INTO mensajes (conversacion_id, rol, contenido) VALUES ($1, 'user', 'intruso')`,
        [CONV_B]
      )
    ).rejects.toThrow(BLOQUEADO);
  });

  it('A NO puede escribir `tokens_usage` (campo de consumo: solo el sistema)', async () => {
    await expect(
      comoIdentidad(
        db,
        comoA,
        `INSERT INTO mensajes (conversacion_id, rol, contenido, tokens_usage) VALUES ($1, 'user', 'x', 0)`,
        [CONV_A]
      )
    ).rejects.toThrow(BLOQUEADO);
  });

  it('A puede crear un análisis propio pero NO uno a nombre de B', async () => {
    const propio = await comoIdentidad(
      db,
      comoA,
      `INSERT INTO analisis (usuario_id, tipo) VALUES ($1, 'x') RETURNING id`,
      [USUARIO_A]
    );
    expect(propio.rows).toHaveLength(1);

    await expect(
      comoIdentidad(db, comoA, `INSERT INTO analisis (usuario_id, tipo) VALUES ($1, 'x')`, [
        USUARIO_B,
      ])
    ).rejects.toThrow(BLOQUEADO);
  });

  it('A puede cambiar el título de su conversación pero NO el de la de B', async () => {
    await comoIdentidad(db, comoA, `UPDATE conversaciones SET titulo = 'renombrada' WHERE id = $1`, [
      CONV_A,
    ]);
    await comoIdentidad(db, comoA, `UPDATE conversaciones SET titulo = 'hackeada' WHERE id = $1`, [
      CONV_B,
    ]);
    const { rows } = await db.query<{ id: string; titulo: string }>(
      `SELECT id, titulo FROM conversaciones ORDER BY id`
    );
    expect(rows).toEqual([
      { id: CONV_A, titulo: 'renombrada' },
      { id: CONV_B, titulo: 'Conversación de B' },
    ]);
  });

  it('A NO puede traspasar su conversación a B (cambiar `usuario_id`)', async () => {
    await expect(
      comoIdentidad(db, comoA, `UPDATE conversaciones SET usuario_id = $1 WHERE id = $2`, [
        USUARIO_B,
        CONV_A,
      ])
    ).rejects.toThrow(BLOQUEADO);
  });

  it('A puede actualizar su nombre pero NO el de B', async () => {
    await comoIdentidad(db, comoA, `UPDATE usuarios SET nombre = 'Nuevo A' WHERE id = $1`, [
      USUARIO_A,
    ]);
    await comoIdentidad(db, comoA, `UPDATE usuarios SET nombre = 'Hackeado' WHERE id = $1`, [
      USUARIO_B,
    ]);
    const { rows } = await db.query<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM usuarios ORDER BY email`
    );
    expect(rows).toEqual([
      { id: USUARIO_A, nombre: 'Nuevo A' },
      { id: USUARIO_B, nombre: 'b' },
    ]);
  });

  it('A NO puede cambiar su email ni su id en `usuarios`', async () => {
    await expect(
      comoIdentidad(db, comoA, `UPDATE usuarios SET email = 'otro@e.cl' WHERE id = $1`, [USUARIO_A])
    ).rejects.toThrow(BLOQUEADO);
    await expect(
      comoIdentidad(db, comoA, `UPDATE usuarios SET id = gen_random_uuid() WHERE id = $1`, [
        USUARIO_A,
      ])
    ).rejects.toThrow(BLOQUEADO);
  });

  it('A NO puede borrar nada (conversaciones, mensajes, análisis ni su fila)', async () => {
    for (const tabla of TABLAS) {
      await expect(comoIdentidad(db, comoA, `DELETE FROM ${tabla}`)).rejects.toThrow(BLOQUEADO);
    }
  });

  it('A NO puede crear filas en `usuarios` (las crea solo el trigger de registro)', async () => {
    await expect(
      comoIdentidad(db, comoA, `INSERT INTO usuarios (id, email, nombre) VALUES ($1, 'z@e.cl', 'Z')`, [
        USUARIO_A,
      ])
    ).rejects.toThrow(BLOQUEADO);
  });
});

describe('Nadie se sube de rol (AD-9 → A)', () => {
  it.each(['consultor', 'admin'])('A NO puede ponerse el rol "%s"', async (rolDeseado) => {
    await expect(
      comoIdentidad(db, comoA, `UPDATE usuarios SET rol = $1 WHERE id = $2`, [
        rolDeseado,
        USUARIO_A,
      ])
    ).rejects.toThrow(BLOQUEADO);

    const { rows } = await db.query<{ rol: string }>(`SELECT rol FROM usuarios WHERE id = $1`, [
      USUARIO_A,
    ]);
    expect(rows[0]?.rol).toBe('cliente');
  });

  it('A NO puede cambiar el rol de B', async () => {
    await expect(
      comoIdentidad(db, comoA, `UPDATE usuarios SET rol = 'admin' WHERE id = $1`, [USUARIO_B])
    ).rejects.toThrow(BLOQUEADO);
  });

  it('el sistema (service_role) SÍ puede cambiar un rol', async () => {
    await comoIdentidad(db, sistema, `UPDATE usuarios SET rol = 'consultor' WHERE id = $1`, [
      USUARIO_A,
    ]);
    const { rows } = await db.query<{ rol: string }>(`SELECT rol FROM usuarios WHERE id = $1`, [
      USUARIO_A,
    ]);
    expect(rows[0]?.rol).toBe('consultor');
  });
});

describe('Sin política = sin acceso: anon (sin sesión)', () => {
  it.each(TABLAS)('anon no puede leer %s', async (tabla) => {
    await expect(comoIdentidad(db, anonimo, `SELECT * FROM ${tabla}`)).rejects.toThrow(BLOQUEADO);
  });

  it('anon no puede insertar ni modificar nada', async () => {
    await expect(
      comoIdentidad(db, anonimo, `INSERT INTO conversaciones (usuario_id) VALUES ($1)`, [USUARIO_A])
    ).rejects.toThrow(BLOQUEADO);
    await expect(comoIdentidad(db, anonimo, `UPDATE usuarios SET nombre = 'x'`)).rejects.toThrow(
      BLOQUEADO
    );
    await expect(comoIdentidad(db, anonimo, `DELETE FROM mensajes`)).rejects.toThrow(BLOQUEADO);
  });
});

describe('Operaciones de sistema: service_role', () => {
  it.each(TABLAS)('service_role sigue viendo todas las filas de %s', async (tabla) => {
    const { rows } = await comoIdentidad(db, sistema, `SELECT * FROM ${tabla}`);
    expect(rows).toHaveLength(2);
  });

  it('service_role puede escribir `tokens_usage` y crear datos de cualquier usuario', async () => {
    const { rows } = await comoIdentidad(
      db,
      sistema,
      `INSERT INTO mensajes (conversacion_id, rol, contenido, tokens_usage)
       VALUES ($1, 'assistant', 'respuesta', 120) RETURNING tokens_usage`,
      [CONV_B]
    );
    expect(rows[0]?.tokens_usage).toBe(120);
  });
});

describe('Higiene de la migración 003', () => {
  it('es repetible: aplicarla dos veces no falla ni duplica políticas', async () => {
    const antes = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`
    );
    await db.exec(leerMigracion('003_auth_rls.sql'));
    const despues = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`
    );
    expect(despues.rows[0]?.n).toBe(antes.rows[0]?.n);
    expect(antes.rows[0]?.n).toBeGreaterThan(0);
  });

  it('las 4 tablas siguen con RLS activado', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname, relrowsecurity FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)`,
      [[...TABLAS]]
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  it('ninguna política se aplica a `anon` ni a PUBLIC', async () => {
    const { rows } = await db.query<{ policyname: string; roles: string[] }>(
      `SELECT policyname, roles::text[] AS roles FROM pg_policies WHERE schemaname = 'public'`
    );
    for (const politica of rows) {
      expect(politica.roles, politica.policyname).not.toContain('anon');
      expect(politica.roles, politica.policyname).not.toContain('public');
    }
  });

  it('la función del trigger fija su search_path (SECURITY DEFINER seguro)', async () => {
    const { rows } = await db.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      `SELECT prosecdef, proconfig FROM pg_proc
        WHERE proname = 'crear_usuario_al_registrarse'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.prosecdef).toBe(true);
    expect(rows[0]?.proconfig?.join(',')).toMatch(/search_path/);
  });
});
