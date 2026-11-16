/**
 * @file lib/auth/__tests__/acceso.test.ts
 * @description Tests de las reglas de acceso por ruta y rol (TASK 9).
 * Se escriben ANTES de la implementación (TDD, mandato #3).
 */

import { describe, it, expect } from 'vitest';
import { decidirAcceso, rutaSiguienteSegura } from '../acceso';

describe('decidirAcceso — rutas públicas', () => {
  it.each(['/', '/auth/login', '/auth/callback', '/ruedadelavida', '/api/auth/login'])(
    'permite %s sin sesión',
    (pathname) => {
      expect(decidirAcceso({ pathname, rol: null })).toEqual({ tipo: 'permitir' });
    },
  );
});

describe('decidirAcceso — /dashboard exige sesión', () => {
  it('sin sesión redirige a /auth/login conservando la ruta pedida', () => {
    const decision = decidirAcceso({ pathname: '/dashboard/asistente', rol: null });
    expect(decision).toEqual({
      tipo: 'redirigir',
      destino: '/auth/login?siguiente=%2Fdashboard%2Fasistente',
    });
  });

  it('con sesión de cliente permite /dashboard', () => {
    expect(decidirAcceso({ pathname: '/dashboard', rol: 'cliente' })).toEqual({ tipo: 'permitir' });
  });

  it('no confunde /dashboardx con /dashboard', () => {
    expect(decidirAcceso({ pathname: '/dashboardx', rol: null })).toEqual({ tipo: 'permitir' });
  });
});

describe('decidirAcceso — rutas de consultor', () => {
  it.each(['/dashboard/consultor', '/dashboard/consultor/clientes', '/api/consultor/saldo'])(
    'un cliente en %s recibe 403',
    (pathname) => {
      expect(decidirAcceso({ pathname, rol: 'cliente' })).toEqual({ tipo: 'rechazar', estado: 403 });
    },
  );

  it.each(['consultor', 'admin'] as const)('el rol %s puede entrar', (rol) => {
    expect(decidirAcceso({ pathname: '/dashboard/consultor', rol })).toEqual({ tipo: 'permitir' });
  });

  it('sin sesión en /dashboard/consultor redirige al login, no da 403', () => {
    expect(decidirAcceso({ pathname: '/dashboard/consultor', rol: null }).tipo).toBe('redirigir');
  });

  it('sin sesión en /api/consultor responde 401', () => {
    expect(decidirAcceso({ pathname: '/api/consultor/saldo', rol: null })).toEqual({
      tipo: 'rechazar',
      estado: 401,
    });
  });
});

describe('decidirAcceso — /api/chat', () => {
  it('sin sesión responde 401 (no redirige: es una API)', () => {
    expect(decidirAcceso({ pathname: '/api/chat', rol: null })).toEqual({
      tipo: 'rechazar',
      estado: 401,
    });
  });

  it('con sesión lo permite', () => {
    expect(decidirAcceso({ pathname: '/api/chat', rol: 'cliente' })).toEqual({ tipo: 'permitir' });
  });
});

describe('rutaSiguienteSegura — evita redirecciones abiertas', () => {
  it('acepta una ruta interna', () => {
    expect(rutaSiguienteSegura('/dashboard/asistente')).toBe('/dashboard/asistente');
  });

  it.each([
    'https://malo.example/robo',
    '//malo.example',
    '/\\malo.example',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('rechaza %s y vuelve a /dashboard', (valor) => {
    expect(rutaSiguienteSegura(valor as string | null | undefined)).toBe('/dashboard');
  });
});
