/**
 * @file lib/supabase/__tests__/config.test.ts
 * @description Tests de la configuración pública de Supabase (TASK 9).
 */

import { describe, it, expect } from 'vitest';
import { leerConfigPublica } from '../config';

describe('leerConfigPublica', () => {
  it('devuelve url, clave anónima y URL de la app', () => {
    const config = leerConfigPublica({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-de-prueba',
      NEXT_PUBLIC_APP_URL: 'https://app.ejemplo.cl/',
    });
    expect(config).toEqual({
      url: 'https://x.supabase.co',
      anonKey: 'anon-de-prueba',
      appUrl: 'https://app.ejemplo.cl',
    });
  });

  it.each(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_APP_URL'])(
    'falla en español si falta %s',
    (faltante) => {
      const env: Record<string, string> = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        NEXT_PUBLIC_APP_URL: 'https://app.ejemplo.cl',
      };
      delete env[faltante];
      expect(() => leerConfigPublica(env)).toThrow(faltante);
    },
  );

  it('rechaza una clave que parece service_role (no debe usarse en el flujo de sesión)', () => {
    expect(() =>
      leerConfigPublica({
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_abc123',
        NEXT_PUBLIC_APP_URL: 'https://app.ejemplo.cl',
      }),
    ).toThrow(/secreta/);
  });

  it('rechaza la clave service_role legada (un JWT con role=service_role)', () => {
    const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.firma`;
    expect(() =>
      leerConfigPublica({
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt,
        NEXT_PUBLIC_APP_URL: 'https://app.ejemplo.cl',
      }),
    ).toThrow(/secreta/);
  });

  it('acepta la clave anon legada (JWT con role=anon)', () => {
    const payload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.firma`;
    expect(
      leerConfigPublica({
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt,
        NEXT_PUBLIC_APP_URL: 'https://app.ejemplo.cl',
      }).anonKey,
    ).toBe(jwt);
  });
});
