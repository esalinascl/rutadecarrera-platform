/**
 * @file api/health/__tests__/route.test.ts
 * @description Pruebas del endpoint GET /api/health (SPEC — health-db, RF-1, RF-2, RF-3, RF-8, RF-9).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/salud', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../lib/salud')>();
  return { ...original, verificarSalud: vi.fn() };
});

// Import DESPUÉS del mock: la ruta usa el `verificarSalud` falso.
import * as modulo from '../route';
import { verificarSalud } from '../../../../lib/salud';

const verificarMock = vi.mocked(verificarSalud);
const REVISADO = '2026-11-02T12:00:00.000Z';

describe('GET /api/health', () => {
  beforeEach(() => {
    verificarMock.mockReset();
  });

  it('RF-1: con la base viva responde 200 y { estado: ok, revisado_en }', async () => {
    verificarMock.mockResolvedValue({ estado: 'ok', revisadoEn: REVISADO });

    const respuesta = await modulo.GET();

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ estado: 'ok', revisado_en: REVISADO });
  });

  it('RF-2: con la base caída responde 503 y { estado: error, revisado_en }', async () => {
    verificarMock.mockResolvedValue({ estado: 'error', revisadoEn: REVISADO });

    const respuesta = await modulo.GET();

    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toEqual({ estado: 'error', revisado_en: REVISADO });
  });

  it('RF-3: el cuerpo tiene EXACTAMENTE las claves estado y revisado_en', async () => {
    for (const estado of ['ok', 'error'] as const) {
      verificarMock.mockResolvedValue({ estado, revisadoEn: REVISADO });
      const cuerpo = await (await modulo.GET()).json();
      expect(Object.keys(cuerpo).sort()).toEqual(['estado', 'revisado_en']);
    }
  });

  it('RF-3: si la verificación lanzara por sorpresa, responde 503 sin filtrar el mensaje', async () => {
    verificarMock.mockRejectedValue(new Error('detalle-secreto-https://proyecto.supabase.co'));

    const respuesta = await modulo.GET();
    const texto = await respuesta.text();

    expect(respuesta.status).toBe(503);
    expect(texto).not.toContain('detalle-secreto');
    expect(texto).not.toContain('supabase');
    const cuerpo = JSON.parse(texto) as Record<string, string>;
    expect(cuerpo.estado).toBe('error');
    expect(Object.keys(cuerpo).sort()).toEqual(['estado', 'revisado_en']);
    expect(Number.isNaN(Date.parse(cuerpo.revisado_en))).toBe(false);
  });

  it('RF-8: la respuesta lleva Cache-Control: no-store (en éxito y en error)', async () => {
    verificarMock.mockResolvedValue({ estado: 'ok', revisadoEn: REVISADO });
    expect((await modulo.GET()).headers.get('cache-control')).toBe('no-store');

    verificarMock.mockResolvedValue({ estado: 'error', revisadoEn: REVISADO });
    expect((await modulo.GET()).headers.get('cache-control')).toBe('no-store');
  });

  it('RF-8: la respuesta es JSON', async () => {
    verificarMock.mockResolvedValue({ estado: 'ok', revisadoEn: REVISADO });

    expect((await modulo.GET()).headers.get('content-type')).toContain('application/json');
  });

  it('RF-9: la ruta es dinámica (nunca se sirve una copia guardada)', () => {
    expect(modulo.dynamic).toBe('force-dynamic');
  });

  it('RF-9: solo expone GET (los demás métodos reciben 405 de Next)', () => {
    const metodos = Object.keys(modulo).filter((clave) => /^(GET|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(clave));
    expect(metodos).toEqual(['GET']);
  });
});
