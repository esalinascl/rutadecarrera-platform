/**
 * @file lib/supabase/__tests__/servidor.test.ts
 * @description Tests del cliente Supabase con sesión (TASK 9). `next/headers` y
 * `@supabase/ssr` se simulan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const almacen = { getAll: vi.fn(), set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => almacen) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({ marca: 'cliente' })) }));

import { createServerClient } from '@supabase/ssr';
import { crearClienteServidor } from '../servidor';

type OpcionesCookies = {
  cookies: {
    getAll: () => unknown;
    setAll: (c: { name: string; value: string; options?: object }[]) => void;
  };
};

describe('crearClienteServidor', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-de-prueba');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.ejemplo.cl');
    almacen.getAll.mockReset();
    almacen.set.mockReset();
    vi.mocked(createServerClient).mockClear();
  });

  it('usa la clave anónima (nunca service_role) y las cookies de la petición', async () => {
    almacen.getAll.mockReturnValue([{ name: 'sb', value: '1' }]);
    await crearClienteServidor();

    const [url, clave, opciones] = vi.mocked(createServerClient).mock.calls[0] as unknown as [string, string, OpcionesCookies];
    expect(url).toBe('https://x.supabase.co');
    expect(clave).toBe('anon-de-prueba');
    expect(opciones.cookies.getAll()).toEqual([{ name: 'sb', value: '1' }]);
  });

  it('escribe en las cookies lo que Supabase renueva', async () => {
    await crearClienteServidor();
    const [, , opciones] = vi.mocked(createServerClient).mock.calls[0] as unknown as [string, string, OpcionesCookies];

    opciones.cookies.setAll([{ name: 'sb', value: 'nuevo', options: { httpOnly: true } }]);
    expect(almacen.set).toHaveBeenCalledWith('sb', 'nuevo', { httpOnly: true });
  });

  it('no falla si no se pueden escribir cookies (Server Component)', async () => {
    almacen.set.mockImplementation(() => {
      throw new Error('Cookies solo modificables en Route Handlers');
    });
    await crearClienteServidor();
    const [, , opciones] = vi.mocked(createServerClient).mock.calls[0] as unknown as [string, string, OpcionesCookies];

    expect(() => opciones.cookies.setAll([{ name: 'sb', value: 'x' }])).not.toThrow();
  });

  it('falla en español si falta la configuración', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    await expect(crearClienteServidor()).rejects.toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });
});
