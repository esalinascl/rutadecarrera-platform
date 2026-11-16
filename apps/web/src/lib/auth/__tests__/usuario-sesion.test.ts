/**
 * @file lib/auth/__tests__/usuario-sesion.test.ts
 * @description Tests de `obtenerUsuarioId` (TASK 9).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
vi.mock('../../supabase/servidor', () => ({
  crearClienteServidor: vi.fn(async () => ({ auth: { getUser } })),
}));

import { obtenerUsuarioId } from '../usuario-sesion';

describe('obtenerUsuarioId', () => {
  beforeEach(() => {
    getUser.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('devuelve el id del usuario con sesión válida', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
    expect(await obtenerUsuarioId()).toBe('u-1');
  });

  it('devuelve null sin sesión', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await obtenerUsuarioId()).toBeNull();
  });

  it('devuelve null si Supabase informa un error (token inválido)', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'JWT expired' } });
    expect(await obtenerUsuarioId()).toBeNull();
  });

  it('falla cerrada: si algo lanza una excepción, no hay usuario', async () => {
    getUser.mockRejectedValue(new Error('caída'));
    expect(await obtenerUsuarioId()).toBeNull();
  });
});
