/**
 * @file api/auth/login/__tests__/route.test.ts
 * @description Tests de POST /api/auth/login (TASK 9). Supabase se simula.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const signInWithOtp = vi.fn();

vi.mock('../../../../../lib/supabase/servidor', () => ({
  crearClienteServidor: vi.fn(async () => ({ auth: { signInWithOtp } })),
}));

import { POST } from '../route';

function pedir(body: unknown, ip = '9.9.9.9'): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-de-prueba');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.ejemplo.cl');
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
  });

  it('envía el Magic Link con la URL de la app (no del encabezado Host)', async () => {
    const respuesta = await POST(pedir({ email: 'ana@correo.cl', siguiente: '/dashboard/asistente' }, '1.1.1.1'));

    expect(respuesta.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'ana@correo.cl',
      options: {
        emailRedirectTo: 'https://app.ejemplo.cl/auth/callback?siguiente=%2Fdashboard%2Fasistente',
        shouldCreateUser: true,
      },
    });
  });

  it('responde 400 con un email inválido', async () => {
    const respuesta = await POST(pedir({ email: 'nada' }, '2.2.2.2'));
    expect(respuesta.status).toBe(400);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('responde 400 si el cuerpo no es JSON', async () => {
    const respuesta = await POST(pedir('{no es json', '3.3.3.3'));
    expect(respuesta.status).toBe(400);
  });

  it('responde 500 sin detalles si falta la configuración', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const respuesta = await POST(pedir({ email: 'ana@correo.cl' }, '4.4.4.4'));

    expect(respuesta.status).toBe(500);
    expect(JSON.stringify(await respuesta.json())).not.toContain('NEXT_PUBLIC');
    error.mockRestore();
  });

  it('responde 429 al superar 5 envíos del mismo correo desde la misma IP', async () => {
    for (let i = 0; i < 5; i++) await POST(pedir({ email: 'rep@correo.cl' }, '5.5.5.5'));
    const sexto = await POST(pedir({ email: 'rep@correo.cl' }, '5.5.5.5'));

    expect(sexto.status).toBe(429);
    expect(signInWithOtp).toHaveBeenCalledTimes(5);
  });
});
