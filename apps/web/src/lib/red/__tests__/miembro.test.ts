/**
 * @file lib/red/__tests__/miembro.test.ts
 * @description Pruebas de la lectura del miembro y de su código DISC (SPEC web
 * de la Red, R3.3, R3.4, R5.1 y R5.3). Se escriben ANTES de la implementación.
 */

import { describe, expect, it, vi } from 'vitest';
import { leerCodigoDisc, leerMiembro, type DependenciasMiembro } from '../miembro';

function deps(parcial: Partial<DependenciasMiembro> = {}): DependenciasMiembro {
  return {
    obtenerUsuarioId: vi.fn(async () => 'u1'),
    leerUsuario: vi.fn(async () => ({ data: { nombre: 'Ana Pérez', rol: 'consultor' }, error: null })),
    leerCodigo: vi.fn(async () => ({ data: { codigo: 'RDC-001' }, error: null })),
    ...parcial,
  };
}

describe('leerMiembro', () => {
  it('sin sesión devuelve «sin-sesion» y no consulta la base', async () => {
    const d = deps({ obtenerUsuarioId: vi.fn(async () => null) });
    expect(await leerMiembro(d)).toEqual({ estado: 'sin-sesion' });
    expect(d.leerUsuario).not.toHaveBeenCalled();
  });

  it.each(['consultor', 'admin'] as const)('el rol %s es miembro y trae su nombre', async (rol) => {
    const d = deps({ leerUsuario: vi.fn(async () => ({ data: { nombre: 'Ana Pérez', rol }, error: null })) });
    expect(await leerMiembro(d)).toEqual({ estado: 'miembro', id: 'u1', nombre: 'Ana Pérez', rol });
    expect(d.leerUsuario).toHaveBeenCalledWith('u1');
  });

  it('un cliente no es miembro', async () => {
    const d = deps({ leerUsuario: vi.fn(async () => ({ data: { nombre: 'Ana', rol: 'cliente' }, error: null })) });
    expect(await leerMiembro(d)).toEqual({ estado: 'no-miembro' });
  });

  it('si la base falla, no es miembro (falla cerrada) y queda en el log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ leerUsuario: vi.fn(async () => ({ data: null, error: { message: 'caída' } })) });
    expect(await leerMiembro(d)).toEqual({ estado: 'no-miembro' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('sin fila en `usuarios` no es miembro', async () => {
    const d = deps({ leerUsuario: vi.fn(async () => ({ data: null, error: null })) });
    expect(await leerMiembro(d)).toEqual({ estado: 'no-miembro' });
  });

  it('un nombre vacío se reemplaza por un saludo genérico', async () => {
    const d = deps({ leerUsuario: vi.fn(async () => ({ data: { nombre: '   ', rol: 'consultor' }, error: null })) });
    expect(await leerMiembro(d)).toMatchObject({ estado: 'miembro', nombre: 'miembro de la Red' });
  });
});

describe('leerCodigoDisc', () => {
  it('devuelve el código asignado al miembro', async () => {
    const d = deps();
    expect(await leerCodigoDisc(d, 'u1')).toEqual({ estado: 'asignado', codigo: 'RDC-001' });
    expect(d.leerCodigo).toHaveBeenCalledWith('u1');
  });

  it('sin fila devuelve «sin-codigo» (R5.3)', async () => {
    const d = deps({ leerCodigo: vi.fn(async () => ({ data: null, error: null })) });
    expect(await leerCodigoDisc(d, 'u1')).toEqual({ estado: 'sin-codigo' });
  });

  it('un código vacío cuenta como sin código', async () => {
    const d = deps({ leerCodigo: vi.fn(async () => ({ data: { codigo: ' ' }, error: null })) });
    expect(await leerCodigoDisc(d, 'u1')).toEqual({ estado: 'sin-codigo' });
  });

  it('si la base falla devuelve «error» y queda en el log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ leerCodigo: vi.fn(async () => ({ data: null, error: { message: 'caída' } })) });
    expect(await leerCodigoDisc(d, 'u1')).toEqual({ estado: 'error' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
