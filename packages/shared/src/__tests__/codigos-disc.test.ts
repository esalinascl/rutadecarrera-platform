/**
 * Pruebas de la migración 004: códigos DISC por miembro (SPEC web de la Red,
 * R5.4, R7.1 y R7.2). Se escriben ANTES de la migración (TDD, mandato 3).
 *
 * Corren el SQL real de 001 + 003 + 004 sobre PGlite con el Supabase mínimo
 * emulado. Se repite la verificación en Supabase staging antes de producción.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  aplicarComoMigrador,
  comoIdentidad,
  crearBaseConMigraciones,
  leerMigracion,
  type Identidad,
} from './helpers/supabase-emulado';

const USUARIO_A = '11111111-1111-4111-8111-111111111111';
const USUARIO_B = '22222222-2222-4222-8222-222222222222';

const comoA: Identidad = { rol: 'authenticated', uid: USUARIO_A };
const anonimo: Identidad = { rol: 'anon' };
const sistema: Identidad = { rol: 'service_role' };

const MIGRACIONES = ['001_init_schema.sql', '003_auth_rls.sql', '004_codigos_disc.sql'];
const BLOQUEADO = { code: '42501' };

let db: PGlite;

beforeEach(async () => {
  db = await crearBaseConMigraciones(MIGRACIONES);
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${USUARIO_A}', 'a@ejemplo.cl'),
      ('${USUARIO_B}', 'b@ejemplo.cl');
  `);
  await comoIdentidad(
    db,
    sistema,
    `INSERT INTO codigos_disc (usuario_id, codigo) VALUES ($1, 'COD-A'), ($2, 'COD-B')`,
    [USUARIO_A, USUARIO_B],
  );
});

afterEach(async () => {
  await db.close();
});

describe('codigos_disc — lectura (R5.4)', () => {
  it('cada miembro ve solo su propio código', async () => {
    const { rows } = await comoIdentidad<{ codigo: string }>(db, comoA, 'SELECT codigo FROM codigos_disc');
    expect(rows).toEqual([{ codigo: 'COD-A' }]);
  });

  it('pedir el código de otro por su id no devuelve nada', async () => {
    const { rows } = await comoIdentidad(db, comoA, 'SELECT codigo FROM codigos_disc WHERE usuario_id = $1', [
      USUARIO_B,
    ]);
    expect(rows).toEqual([]);
  });

  it('anon no puede leer la tabla', async () => {
    await expect(comoIdentidad(db, anonimo, 'SELECT * FROM codigos_disc')).rejects.toMatchObject(BLOQUEADO);
  });
});

describe('codigos_disc — escritura solo del sistema (R7.1)', () => {
  it('un miembro no puede crearse un código', async () => {
    await comoIdentidad(db, sistema, 'DELETE FROM codigos_disc WHERE usuario_id = $1', [USUARIO_A]);
    await expect(
      comoIdentidad(db, comoA, `INSERT INTO codigos_disc (usuario_id, codigo) VALUES ($1, 'MIO')`, [USUARIO_A]),
    ).rejects.toMatchObject(BLOQUEADO);
  });

  it('un miembro no puede cambiar su código', async () => {
    await expect(
      comoIdentidad(db, comoA, `UPDATE codigos_disc SET codigo = 'OTRO' WHERE usuario_id = $1`, [USUARIO_A]),
    ).rejects.toMatchObject(BLOQUEADO);
  });

  it('un miembro no puede borrar su código', async () => {
    await expect(
      comoIdentidad(db, comoA, 'DELETE FROM codigos_disc WHERE usuario_id = $1', [USUARIO_A]),
    ).rejects.toMatchObject(BLOQUEADO);
  });

  it('el sistema puede reasignar un código', async () => {
    await comoIdentidad(db, sistema, `UPDATE codigos_disc SET codigo = 'COD-A2' WHERE usuario_id = $1`, [
      USUARIO_A,
    ]);
    const { rows } = await comoIdentidad<{ codigo: string }>(db, comoA, 'SELECT codigo FROM codigos_disc');
    expect(rows).toEqual([{ codigo: 'COD-A2' }]);
  });
});

describe('codigos_disc — integridad', () => {
  it('un código no se repite entre dos miembros', async () => {
    await expect(
      comoIdentidad(db, sistema, `UPDATE codigos_disc SET codigo = 'COD-A' WHERE usuario_id = $1`, [USUARIO_B]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('un miembro tiene a lo más un código (usuario_id es la llave)', async () => {
    await expect(
      comoIdentidad(db, sistema, `INSERT INTO codigos_disc (usuario_id, codigo) VALUES ($1, 'COD-A3')`, [
        USUARIO_A,
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('un código vacío se rechaza', async () => {
    await expect(
      comoIdentidad(db, sistema, `UPDATE codigos_disc SET codigo = '  ' WHERE usuario_id = $1`, [USUARIO_A]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('al borrar la cuenta se borra su código', async () => {
    await db.exec(`DELETE FROM auth.users WHERE id = '${USUARIO_A}'`);
    const { rows } = await comoIdentidad(db, sistema, 'SELECT usuario_id FROM codigos_disc');
    expect(rows).toEqual([{ usuario_id: USUARIO_B }]);
  });

  it('marca la fecha de asignación', async () => {
    const { rows } = await comoIdentidad<{ asignado_en: Date | null }>(
      db,
      sistema,
      'SELECT asignado_en FROM codigos_disc WHERE usuario_id = $1',
      [USUARIO_A],
    );
    expect(rows[0]?.asignado_en).toBeInstanceOf(Date);
  });
});

describe('migración 004', () => {
  it('la reversa quita la tabla sin tocar la 003, y la 004 se puede volver a aplicar', async () => {
    await aplicarComoMigrador(db, leerMigracion('reversas/004_codigos_disc_reversa.sql'));
    const { rows: tabla } = await comoIdentidad(db, sistema, "SELECT to_regclass('public.codigos_disc') AS t");
    expect(tabla).toEqual([{ t: null }]);
    const { rows: usuarios } = await comoIdentidad(db, sistema, 'SELECT count(*)::int AS n FROM usuarios');
    expect(usuarios).toEqual([{ n: 2 }]);
    // La reversa también es repetible.
    await aplicarComoMigrador(db, leerMigracion('reversas/004_codigos_disc_reversa.sql'));
    await aplicarComoMigrador(db, leerMigracion('004_codigos_disc.sql'));
    const { rows } = await comoIdentidad(db, sistema, 'SELECT count(*)::int AS n FROM codigos_disc');
    expect(rows).toEqual([{ n: 0 }]);
  });


  it('es repetible: aplicarla dos veces no falla ni duplica datos', async () => {
    await aplicarComoMigrador(db, leerMigracion('004_codigos_disc.sql'));
    const { rows } = await comoIdentidad(db, sistema, 'SELECT count(*)::int AS n FROM codigos_disc');
    expect(rows).toEqual([{ n: 2 }]);
  });
});
