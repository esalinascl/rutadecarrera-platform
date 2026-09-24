/**
 * Tests del cliente de base de datos con un Supabase simulado.
 * No requieren red ni credenciales.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DatabaseError,
  SupabaseDatabaseClient,
  crearRepositorios,
  leerConfigSupabase,
} from '../db/client';

type Resultado = { data: unknown; error: { message: string; code?: string } | null };

/**
 * Simula el query builder encadenable de Supabase. Cualquier método devuelve
 * el mismo builder; al hacer `await` (o `.single()` / `.maybeSingle()`)
 * resuelve con el resultado configurado. Registra las llamadas para verificarlas.
 */
function supabaseSimulado(resultado: Resultado) {
  const llamadas: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  const encadenar = (metodo: string) =>
    vi.fn((...args: unknown[]) => {
      llamadas.push([metodo, args]);
      return builder;
    });

  for (const metodo of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
    builder[metodo] = encadenar(metodo);
  }
  builder.single = vi.fn(async () => resultado);
  builder.maybeSingle = vi.fn(async () => resultado);
  builder.then = (resolver: (r: Resultado) => unknown) => Promise.resolve(resultado).then(resolver);

  const client = {
    from: vi.fn((tabla: string) => {
      llamadas.push(['from', [tabla]]);
      return builder;
    }),
  } as unknown as SupabaseClient;

  return { client, llamadas };
}

const USUARIO = {
  id: 'u-1',
  email: 'ana@example.com',
  nombre: 'Ana',
  contexto_inicial: null,
  creado_en: '2026-09-24T10:00:00.000Z',
  actualizado_en: '2026-09-24T10:00:00.000Z',
};

describe('leerConfigSupabase', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve la configuración cuando las variables existen', () => {
    const config = leerConfigSupabase({
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'clave-servidor',
    });
    expect(config).toEqual({ url: 'https://x.supabase.co', serviceRoleKey: 'clave-servidor' });
  });

  it('falla si falta la service role key (no acepta la clave anon como sustituto)', () => {
    expect(() =>
      leerConfigSupabase({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' })
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('se niega a ejecutarse en el navegador', () => {
    vi.stubGlobal('window', {});
    expect(() =>
      leerConfigSupabase({
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'clave-servidor',
      })
    ).toThrow(/solo puede usarse en el servidor/);
  });
});

describe('SupabaseDatabaseClient', () => {
  it('queda conectado cuando la consulta de prueba funciona', async () => {
    const { client } = supabaseSimulado({ data: [], error: null });
    const db = new SupabaseDatabaseClient(client);

    await db.connect();

    expect(db.isConnected()).toBe(true);
  });

  it('lanza DatabaseError y queda desconectado si la base responde con error', async () => {
    const { client } = supabaseSimulado({ data: null, error: { message: 'timeout', code: '57014' } });
    const db = new SupabaseDatabaseClient(client);

    await expect(db.connect()).rejects.toBeInstanceOf(DatabaseError);
    expect(db.isConnected()).toBe(false);
  });

  it('disconnect deja el estado desconectado', async () => {
    const { client } = supabaseSimulado({ data: [], error: null });
    const db = new SupabaseDatabaseClient(client);
    await db.connect();

    await db.disconnect();

    expect(db.isConnected()).toBe(false);
  });
});

describe('Repositorios', () => {
  it('findById devuelve null cuando no existe (sin lanzar error)', async () => {
    const { client } = supabaseSimulado({ data: null, error: null });
    const { usuarios } = crearRepositorios(client);

    await expect(usuarios.findById('no-existe')).resolves.toBeNull();
  });

  it('findById devuelve la entidad cuando existe', async () => {
    const { client } = supabaseSimulado({ data: USUARIO, error: null });
    const { usuarios } = crearRepositorios(client);

    await expect(usuarios.findById('u-1')).resolves.toEqual(USUARIO);
  });

  it('propaga los errores como DatabaseError con la operación que falló', async () => {
    const { client } = supabaseSimulado({ data: null, error: { message: 'duplicate key' } });
    const { usuarios } = crearRepositorios(client);

    await expect(
      usuarios.create({ email: 'ana@example.com', nombre: 'Ana', contexto_inicial: null })
    ).rejects.toThrow(/usuarios\.create.*duplicate key/);
  });

  it('update marca actualizado_en con la fecha actual en ISO', async () => {
    const { client, llamadas } = supabaseSimulado({ data: USUARIO, error: null });
    const { usuarios } = crearRepositorios(client);

    await usuarios.update('u-1', { nombre: 'Ana María' });

    const [, [cambios]] = llamadas.find(([metodo]) => metodo === 'update')!;
    expect(cambios).toMatchObject({ nombre: 'Ana María' });
    expect((cambios as { actualizado_en: string }).actualizado_en).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('el historial de mensajes se pide en orden cronológico ascendente', async () => {
    const { client, llamadas } = supabaseSimulado({ data: [], error: null });
    const { mensajes } = crearRepositorios(client);

    await mensajes.findByConversacionId('c-1');

    expect(llamadas).toContainEqual(['from', ['mensajes']]);
    expect(llamadas).toContainEqual(['eq', ['conversacion_id', 'c-1']]);
    expect(llamadas).toContainEqual(['order', ['creado_en', { ascending: true }]]);
  });

  it('las listas vacías se devuelven como arreglo, nunca null', async () => {
    const { client } = supabaseSimulado({ data: null, error: null });
    const { conversaciones } = crearRepositorios(client);

    await expect(conversaciones.findByUsuarioId('u-1')).resolves.toEqual([]);
  });
});

/**
 * Cobertura de TODAS las operaciones de los cuatro repositorios:
 * cada una debe (1) consultar la tabla correcta, (2) devolver los datos en
 * caso de éxito y (3) lanzar DatabaseError con el nombre de la operación si
 * Supabase responde con error. Ningún error se silencia.
 */
type Operacion = {
  nombre: string;
  tabla: string;
  ejecutar: (r: ReturnType<typeof crearRepositorios>) => Promise<unknown>;
  /** Valor esperado cuando Supabase devuelve `data: FILA`. */
  esperado: 'fila' | 'lista' | 'nada';
};

const FILA = { id: 'x-1' };

const OPERACIONES: Operacion[] = [
  { nombre: 'usuarios.create', tabla: 'usuarios', esperado: 'fila',
    ejecutar: (r) => r.usuarios.create({ email: 'a@b.cl', nombre: 'Ana', contexto_inicial: null }) },
  { nombre: 'usuarios.findById', tabla: 'usuarios', esperado: 'fila',
    ejecutar: (r) => r.usuarios.findById('x-1') },
  { nombre: 'usuarios.findByEmail', tabla: 'usuarios', esperado: 'fila',
    ejecutar: (r) => r.usuarios.findByEmail('a@b.cl') },
  { nombre: 'usuarios.update', tabla: 'usuarios', esperado: 'fila',
    ejecutar: (r) => r.usuarios.update('x-1', { nombre: 'Ana' }) },
  { nombre: 'usuarios.delete', tabla: 'usuarios', esperado: 'nada',
    ejecutar: (r) => r.usuarios.delete('x-1') },

  { nombre: 'conversaciones.create', tabla: 'conversaciones', esperado: 'fila',
    ejecutar: (r) => r.conversaciones.create({ usuario_id: 'u-1', titulo: null }) },
  { nombre: 'conversaciones.findById', tabla: 'conversaciones', esperado: 'fila',
    ejecutar: (r) => r.conversaciones.findById('x-1') },
  { nombre: 'conversaciones.findByUsuarioId', tabla: 'conversaciones', esperado: 'lista',
    ejecutar: (r) => r.conversaciones.findByUsuarioId('u-1') },
  { nombre: 'conversaciones.update', tabla: 'conversaciones', esperado: 'fila',
    ejecutar: (r) => r.conversaciones.update('x-1', { titulo: 'Nuevo' }) },
  { nombre: 'conversaciones.delete', tabla: 'conversaciones', esperado: 'nada',
    ejecutar: (r) => r.conversaciones.delete('x-1') },

  { nombre: 'mensajes.create', tabla: 'mensajes', esperado: 'fila',
    ejecutar: (r) => r.mensajes.create({ conversacion_id: 'c-1', rol: 'user', contenido: 'Hola', tokens_usage: null }) },
  { nombre: 'mensajes.findById', tabla: 'mensajes', esperado: 'fila',
    ejecutar: (r) => r.mensajes.findById('x-1') },
  { nombre: 'mensajes.findByConversacionId', tabla: 'mensajes', esperado: 'lista',
    ejecutar: (r) => r.mensajes.findByConversacionId('c-1') },

  { nombre: 'analisis.create', tabla: 'analisis', esperado: 'fila',
    ejecutar: (r) => r.analisis.create({ usuario_id: 'u-1', tipo: 'empleabilidad', resultado: null }) },
  { nombre: 'analisis.findById', tabla: 'analisis', esperado: 'fila',
    ejecutar: (r) => r.analisis.findById('x-1') },
  { nombre: 'analisis.findByUsuarioId', tabla: 'analisis', esperado: 'lista',
    ejecutar: (r) => r.analisis.findByUsuarioId('u-1') },
];

describe('Repositorios: todas las operaciones', () => {
  it.each(OPERACIONES)('$nombre consulta la tabla "$tabla" y devuelve el resultado', async (op) => {
    const data = op.esperado === 'lista' ? [FILA] : FILA;
    const { client, llamadas } = supabaseSimulado({ data, error: null });

    const resultado = await op.ejecutar(crearRepositorios(client));

    expect(llamadas[0]).toEqual(['from', [op.tabla]]);
    if (op.esperado === 'nada') expect(resultado).toBeUndefined();
    else expect(resultado).toEqual(data);
  });

  it.each(OPERACIONES)('$nombre lanza DatabaseError si Supabase falla', async (op) => {
    const { client } = supabaseSimulado({ data: null, error: { message: 'falla simulada', code: 'XX000' } });

    const promesa = op.ejecutar(crearRepositorios(client));

    await expect(promesa).rejects.toBeInstanceOf(DatabaseError);
    await expect(promesa).rejects.toMatchObject({ operacion: op.nombre, codigo: 'XX000' });
  });

  it('las actualizaciones de conversaciones también marcan actualizado_en', async () => {
    const { client, llamadas } = supabaseSimulado({ data: FILA, error: null });

    await crearRepositorios(client).conversaciones.update('x-1', { titulo: 'Nuevo' });

    const [, [cambios]] = llamadas.find(([metodo]) => metodo === 'update')!;
    expect(cambios).toHaveProperty('actualizado_en');
  });
});
