/**
 * @file __tests__/proxy.test.ts
 * @description Tests del proxy de autenticación (TASK 9): sin sesión,
 * rol insuficiente y rutas públicas. Supabase se simula.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  })),
}));

import { createServerClient } from '@supabase/ssr';
import { proxy } from '../proxy';

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
});
