/**
 * @file lib/auth/__tests__/acceso.test.ts
 * @description Tests de las reglas de acceso por ruta y rol (TASK 9).
 * Se escriben ANTES de la implementación (TDD, mandato #3).
 */

import { describe, it, expect } from 'vitest';
import { decidirAcceso, rutaSiguienteSegura } from '../acceso';

describe('decidirAcceso — rutas públicas', () => {
  it.each(['/', '/auth/login', '/auth/callback', '/ruedadelavida', '/api/auth/login', '/sin-acceso'])(
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

  it('con sesión de cliente permite /dashboard/asistente', () => {
    expect(decidirAcceso({ pathname: '/dashboard/asistente', rol: 'cliente' })).toEqual({ tipo: 'permitir' });
  });

  it('no confunde /dashboardx con /dashboard', () => {
    expect(decidirAcceso({ pathname: '/dashboardx', rol: null })).toEqual({ tipo: 'permitir' });
  });
});

describe('decidirAcceso — /dashboard ya no da 404 (R3.6)', () => {
  it.each(['/dashboard', '/dashboard/consultor', '/dashboard/consultor/clientes'])(
    'con sesión, %s lleva al área de miembros',
    (pathname) => {
      for (const rol of ['cliente', 'consultor', 'admin'] as const) {
        expect(decidirAcceso({ pathname, rol })).toEqual({ tipo: 'redirigir', destino: '/red' });
      }
    },
  );

  it('sin sesión, /dashboard/consultor redirige al login, no da 403', () => {
    expect(decidirAcceso({ pathname: '/dashboard/consultor', rol: null })).toEqual({
      tipo: 'redirigir',
      destino: '/auth/login?siguiente=%2Fdashboard%2Fconsultor',
    });
  });
});

describe('decidirAcceso — área de miembros /red (R3)', () => {
  it.each(['/red', '/red/herramientas/disc'])('sin sesión, %s redirige al login con la ruta pedida', (pathname) => {
    expect(decidirAcceso({ pathname, rol: null })).toEqual({
      tipo: 'redirigir',
      destino: `/auth/login?siguiente=${encodeURIComponent(pathname)}`,
    });
  });

  it.each(['/red', '/red/herramientas/disc'])('un cliente en %s va a la página «solo miembros»', (pathname) => {
    expect(decidirAcceso({ pathname, rol: 'cliente' })).toEqual({ tipo: 'redirigir', destino: '/sin-acceso' });
  });

  it.each(['consultor', 'admin'] as const)('el rol %s entra a /red', (rol) => {
    expect(decidirAcceso({ pathname: '/red/herramientas/disc', rol })).toEqual({ tipo: 'permitir' });
  });

  it('no confunde /redes con /red', () => {
    expect(decidirAcceso({ pathname: '/redes', rol: null })).toEqual({ tipo: 'permitir' });
  });

  it('/sin-acceso es pública (no hay bucle de redirecciones)', () => {
    expect(decidirAcceso({ pathname: '/sin-acceso', rol: 'cliente' })).toEqual({ tipo: 'permitir' });
  });
});

describe('decidirAcceso — API de consultor', () => {
  it('un cliente en /api/consultor recibe 403', () => {
    expect(decidirAcceso({ pathname: '/api/consultor/saldo', rol: 'cliente' })).toEqual({
      tipo: 'rechazar',
      estado: 403,
    });
  });

  it.each(['consultor', 'admin'] as const)('el rol %s usa /api/consultor', (rol) => {
    expect(decidirAcceso({ pathname: '/api/consultor/saldo', rol })).toEqual({ tipo: 'permitir' });
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
    expect(rutaSiguienteSegura('/red/herramientas/disc')).toBe('/red/herramientas/disc');
  });

  it.each([
    'https://malo.example/robo',
    '//malo.example',
    '/\\malo.example',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('rechaza %s y vuelve al área de miembros /red', (valor) => {
    expect(rutaSiguienteSegura(valor as string | null | undefined)).toBe('/red');
  });
});
