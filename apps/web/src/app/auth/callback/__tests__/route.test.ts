/**
 * @file auth/callback/__tests__/route.test.ts
 * @description Tests de GET /auth/callback (TASK 9). Supabase se simula.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const exchangeCodeForSession = vi.fn();

vi.mock('../../../../lib/supabase/servidor', () => ({
  crearClienteServidor: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
}));

import { GET } from '../route';

function pedir(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/auth/callback${query}`);
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-de-prueba');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.ejemplo.cl');
    exchangeCodeForSession.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('canjea el código y redirige a la ruta pedida', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const respuesta = await GET(pedir('?code=abc&siguiente=%2Fdashboard%2Fasistente'));

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(respuesta.headers.get('location')).toBe('https://app.ejemplo.cl/dashboard/asistente');
  });

  it('no permite redirigir a otro dominio (redirección abierta)', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const respuesta = await GET(pedir('?code=abc&siguiente=https%3A%2F%2Fmalo.example'));

    expect(respuesta.headers.get('location')).toBe('https://app.ejemplo.cl/dashboard');
  });

  it('sin código vuelve al login con error', async () => {
    const respuesta = await GET(pedir(''));

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(respuesta.headers.get('location')).toBe('https://app.ejemplo.cl/auth/login?error=enlace_invalido');
  });

  it('con código vencido o inválido vuelve al login con error', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } });
    const respuesta = await GET(pedir('?code=viejo'));

    expect(respuesta.headers.get('location')).toBe('https://app.ejemplo.cl/auth/login?error=enlace_invalido');
  });

  it('si el canje lanza una excepción, vuelve al login con error', async () => {
    exchangeCodeForSession.mockRejectedValue(new Error('red caída'));
    const respuesta = await GET(pedir('?code=abc'));

    expect(respuesta.headers.get('location')).toBe('https://app.ejemplo.cl/auth/login?error=enlace_invalido');
  });
});
