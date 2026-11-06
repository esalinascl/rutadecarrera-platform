/**
 * @file __tests__/proxy.test.ts
 * @description Tests del proxy de autenticación (TASK 9): sin sesión,
 * rol insuficiente y rutas públicas. Supabase se simula.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq }) }),
  })),
}));

import { createServerClient } from '@supabase/ssr';
import { proxy, config } from '../proxy';
import { decidirAcceso } from '../lib/auth/acceso';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

function pedir(ruta: string): NextRequest {
  return new NextRequest(`http://localhost:3000${ruta}`);
}

describe('proxy', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-de-prueba');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    getUser.mockReset();
    maybeSingle.mockReset();
    eq.mockClear();
    vi.mocked(createServerClient).mockClear();
  });

  it('una ruta pública no consulta a Supabase', async () => {
    const respuesta = await proxy(pedir('/auth/login'));
    expect(respuesta.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('sin sesión, /dashboard redirige al login con la ruta pedida', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const respuesta = await proxy(pedir('/dashboard/asistente'));
    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get('location')).toContain('/auth/login?siguiente=%2Fdashboard%2Fasistente');
  });

  it('sin sesión, /api/chat responde 401 en JSON', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const respuesta = await proxy(pedir('/api/chat'));
    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({ error: 'No autenticado' });
  });

  it('un cliente en /dashboard/consultor recibe 403', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { rol: 'cliente' }, error: null });
    const respuesta = await proxy(pedir('/dashboard/consultor'));
    expect(respuesta.status).toBe(403);
  });

  it('un consultor entra a /dashboard/consultor', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { rol: 'consultor' }, error: null });
    const respuesta = await proxy(pedir('/dashboard/consultor'));
    expect(respuesta.status).toBe(200);
  });

  it('si no se puede leer el rol, niega el acceso de consultor (falla cerrada)', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'fallo' } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const respuesta = await proxy(pedir('/dashboard/consultor'));
    expect(respuesta.status).toBe(403);
    error.mockRestore();
  });

  it('un cliente con sesión entra a /dashboard sin consultar su rol', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const respuesta = await proxy(pedir('/dashboard'));
    expect(respuesta.status).toBe(200);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it('copia a la respuesta las cookies de sesión que Supabase renueva', async () => {
    getUser.mockImplementation(async () => {
      // Simula que Supabase renueva el token durante getUser().
      const [, , opciones] = vi.mocked(createServerClient).mock.calls.at(-1) as unknown as [
        string,
        string,
        { cookies: { setAll: (c: { name: string; value: string; options?: object }[]) => void } },
      ];
      opciones.cookies.setAll([{ name: 'sb-token', value: 'renovado', options: { httpOnly: true } }]);
      return { data: { user: { id: 'u1' } }, error: null };
    });

    const respuesta = await proxy(pedir('/dashboard'));

    expect(respuesta.cookies.get('sb-token')?.value).toBe('renovado');
  });

  it('la consulta del rol usa el id del usuario autenticado', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'usuario-123' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { rol: 'admin' }, error: null });
    await proxy(pedir('/api/consultor/saldo'));

    expect(eq).toHaveBeenCalledWith('id', 'usuario-123');
  });

  it('/api/consultor sin sesión responde 401 y con rol cliente 403', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await proxy(pedir('/api/consultor/saldo'))).status).toBe(401);

    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { rol: 'cliente' }, error: null });
    expect((await proxy(pedir('/api/consultor/saldo'))).status).toBe(403);
  });

  /** Simula que Supabase renueva el token durante getUser(), con sus encabezados anti-caché. */
  function simularRenovacion(usuario: { id: string } | null) {
    getUser.mockImplementation(async () => {
      const [, , opciones] = vi.mocked(createServerClient).mock.calls.at(-1) as unknown as [
        string,
        string,
        { cookies: { setAll: (c: { name: string; value: string }[], h: Record<string, string>) => void } },
      ];
      opciones.cookies.setAll([{ name: 'sb-token', value: 'renovado' }], {
        'Cache-Control': 'private, no-store',
        Pragma: 'no-cache',
      });
      return { data: { user: usuario }, error: null };
    });
  }

  it('reenvía los encabezados anti-caché que entrega Supabase (evita que un CDN sirva el token a otro)', async () => {
    simularRenovacion({ id: 'u1' });
    const respuesta = await proxy(pedir('/dashboard'));

    expect(respuesta.headers.get('cache-control')).toBe('private, no-store');
    expect(respuesta.headers.get('pragma')).toBe('no-cache');
  });

  it('la cookie renovada llega también a la petición que sigue hacia el handler (no solo al navegador)', async () => {
    simularRenovacion({ id: 'u1' });
    const peticion = pedir('/api/chat');
    await proxy(peticion);

    expect(peticion.cookies.get('sb-token')?.value).toBe('renovado');
  });

  it.each([
    ['redirección (sin sesión en /dashboard)', '/dashboard', null],
    ['401 (sin sesión en /api/chat)', '/api/chat', null],
  ])('las cookies renovadas se conservan también en la respuesta %s', async (_nombre, ruta, usuario) => {
    simularRenovacion(usuario);
    const respuesta = await proxy(pedir(ruta));

    expect(respuesta.cookies.get('sb-token')?.value).toBe('renovado');
    expect(respuesta.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('matcher del proxy', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-de-prueba');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    getUser.mockReset();
  });

  const protegidas = [
    '/dashboard',
    '/dashboard/asistente',
    '/dashboard/consultor',
    '/dashboard/consultor/clientes',
    '/api/chat',
    '/api/consultor',
    '/api/consultor/saldo',
  ];
  const publicas = ['/', '/auth/login', '/auth/callback', '/api/auth/login', '/ruedadelavida', '/dashboardx'];

  it.each(protegidas)('%s está cubierta por el matcher Y exige acceso (las dos listas coinciden)', (ruta) => {
    expect(decidirAcceso({ pathname: ruta, rol: null }).tipo).not.toBe('permitir');
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${ruta}` })).toBe(true);
  });

  it.each(protegidas)('%s: sin sesión, el proxy NO la deja pasar (coherencia con requiereSesion)', async (ruta) => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const respuesta = await proxy(pedir(ruta));
    expect(respuesta.status).not.toBe(200);
  });

  it.each(publicas)('%s es pública y el matcher no la intercepta', (ruta) => {
    expect(decidirAcceso({ pathname: ruta, rol: null }).tipo).toBe('permitir');
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${ruta}` })).toBe(false);
  });
});
