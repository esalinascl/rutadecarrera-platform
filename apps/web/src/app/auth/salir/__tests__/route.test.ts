/**
 * @file auth/salir/__tests__/route.test.ts
 * @description POST /auth/salir (R3.5). Supabase se simula.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const signOut = vi.fn();

vi.mock('../../../../lib/supabase/servidor', () => ({
  crearClienteServidor: vi.fn(async () => ({ auth: { signOut } })),
}));

import { POST } from '../route';

describe('POST /auth/salir', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-de-prueba');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.ejemplo.cl');
    signOut.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('cierra la sesión y vuelve a la portada con 303', async () => {
    signOut.mockResolvedValue({ error: null });
    const respuesta = await POST();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(respuesta.status).toBe(303);
    expect(respuesta.headers.get('location')).toBe('https://app.ejemplo.cl/');
  });

  it('aunque Supabase falle, vuelve a la portada y lo deja en el log', async () => {
    signOut.mockResolvedValue({ error: { message: 'caída' } });
    const respuesta = await POST();
    expect(respuesta.headers.get('location')).toBe('https://app.ejemplo.cl/');
    expect(console.error).toHaveBeenCalled();
  });

  it('una excepción inesperada tampoco deja al usuario sin respuesta', async () => {
    signOut.mockRejectedValue(new Error('red'));
    const respuesta = await POST();
    expect(respuesta.status).toBe(303);
  });
});
