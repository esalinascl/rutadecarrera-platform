/**
 * @file lib/auth/__tests__/login.test.ts
 * @description Tests del caso de uso «pedir Magic Link» (TASK 9).
 */

import { describe, it, expect, vi } from 'vitest';
import { solicitarMagicLink, MENSAJE_NEUTRO } from '../login';
import { crearLimitador } from '../limitador';

function crearDeps(sobrescribir: Partial<Parameters<typeof solicitarMagicLink>[1]> = {}) {
  return {
    enviarOtp: vi.fn().mockResolvedValue({ error: null }),
    limitadorCorreo: crearLimitador({ max: 3, ventanaMs: 60_000, reloj: () => 0 }),
    limitadorIp: crearLimitador({ max: 100, ventanaMs: 60_000, reloj: () => 0 }),
    urlCallback: 'https://app.ejemplo.cl/auth/callback',
    ...sobrescribir,
  };
}

describe('solicitarMagicLink', () => {
  it('envía el enlace y responde con el mensaje neutro', async () => {
    const deps = crearDeps();
    const resultado = await solicitarMagicLink({ email: 'Ana@Correo.cl', ip: '1.1.1.1', siguiente: '/dashboard' }, deps);

    expect(resultado).toEqual({ estado: 200, mensaje: MENSAJE_NEUTRO });
    expect(deps.enviarOtp).toHaveBeenCalledWith('ana@correo.cl', 'https://app.ejemplo.cl/auth/callback?siguiente=%2Fdashboard');
  });

  it('rechaza un email inválido con 400 sin enviar nada', async () => {
    const deps = crearDeps();
    const resultado = await solicitarMagicLink({ email: 'no-es-email', ip: null, siguiente: null }, deps);

    expect(resultado.estado).toBe(400);
    expect(deps.enviarOtp).not.toHaveBeenCalled();
  });

  it('el mensaje es el mismo exista o no el email: si Supabase falla igual responde neutro', async () => {
    const deps = crearDeps({ enviarOtp: vi.fn().mockResolvedValue({ error: { message: 'User not found' } }) });
    const resultado = await solicitarMagicLink({ email: 'ana@correo.cl', ip: null, siguiente: null }, deps);

    expect(resultado).toEqual({ estado: 200, mensaje: MENSAJE_NEUTRO });
  });

  it('si el envío lanza una excepción, responde neutro y no propaga el detalle', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = crearDeps({ enviarOtp: vi.fn().mockRejectedValue(new Error('SMTP caído: secreto-interno')) });
    const resultado = await solicitarMagicLink({ email: 'ana@correo.cl', ip: null, siguiente: null }, deps);

    expect(resultado).toEqual({ estado: 200, mensaje: MENSAJE_NEUTRO });
    expect(JSON.stringify(resultado)).not.toContain('secreto-interno');
    error.mockRestore();
  });

  it('responde 429 al superar el límite por IP aunque cada correo sea distinto', async () => {
    const deps = crearDeps({ limitadorIp: crearLimitador({ max: 2, ventanaMs: 60_000, reloj: () => 0 }) });
    await solicitarMagicLink({ email: 'a@correo.cl', ip: '7.7.7.7', siguiente: null }, deps);
    await solicitarMagicLink({ email: 'b@correo.cl', ip: '7.7.7.7', siguiente: null }, deps);
    const tercero = await solicitarMagicLink({ email: 'c@correo.cl', ip: '7.7.7.7', siguiente: null }, deps);

    expect(tercero.estado).toBe(429);
    expect(deps.enviarOtp).toHaveBeenCalledTimes(2);
  });

  it('el límite por correo vale desde cualquier IP (no se bombardea a una víctima cambiando de IP)', async () => {
    const deps = crearDeps();
    for (let i = 0; i < 3; i++) {
      await solicitarMagicLink({ email: 'victima@correo.cl', ip: `10.0.0.${i}`, siguiente: null }, deps);
    }
    const cuarto = await solicitarMagicLink({ email: 'victima@correo.cl', ip: '10.0.0.99', siguiente: null }, deps);

    expect(cuarto.estado).toBe(429);
    expect(deps.enviarOtp).toHaveBeenCalledTimes(3);
  });

  it('responde 429 al superar el límite y no envía el correo', async () => {
    const deps = crearDeps();
    const pedido = { email: 'ana@correo.cl', ip: '1.1.1.1', siguiente: null };
    for (let i = 0; i < 3; i++) await solicitarMagicLink(pedido, deps);
    const cuarto = await solicitarMagicLink(pedido, deps);

    expect(cuarto.estado).toBe(429);
    expect(deps.enviarOtp).toHaveBeenCalledTimes(3);
  });

  it('un `siguiente` externo se reemplaza por /dashboard (sin redirección abierta)', async () => {
    const deps = crearDeps();
    await solicitarMagicLink({ email: 'ana@correo.cl', ip: null, siguiente: 'https://malo.example' }, deps);

    expect(deps.enviarOtp).toHaveBeenCalledWith('ana@correo.cl', 'https://app.ejemplo.cl/auth/callback?siguiente=%2Fdashboard');
  });
});
