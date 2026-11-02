/**
 * @file lib/salud/__tests__/verificar-base.test.ts
 * @description Pruebas de la lógica de salud de la base (SPEC — health-db, RF-1 a RF-7).
 *
 * La consulta real se reemplaza por una función falsa; el reloj y los temporizadores se
 * controlan a mano. Los números de tiempo (3_999, 4_000, 29_999, 30_000) están escritos
 * a propósito en lugar de importar las constantes: si alguien cambia el tiempo límite o
 * la vigencia, estas pruebas lo obligan a decidirlo.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearVerificadorDeSalud } from '../verificar-base';
import { ErrorBaseDeDatosSalud, ErrorConfiguracionSalud } from '../errores';

const INICIO = Date.parse('2026-11-02T12:00:00.000Z');

/** Reloj de prueba: `ahora()` devuelve `t`, que cada prueba avanza a mano. */
function relojFalso(inicio = INICIO) {
  const reloj = { t: inicio, ahora: () => reloj.t };
  return reloj;
}

describe('crearVerificadorDeSalud', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- RF-1 / RF-2: resultado ----------------------------------------------------------
  it('RF-1: si la consulta responde, el estado es ok y trae la fecha ISO de la revisión', async () => {
    const consulta = vi.fn().mockResolvedValue(undefined);
    const verificar = crearVerificadorDeSalud({ consulta, ahora: () => INICIO, registrar: vi.fn() });

    expect(await verificar()).toEqual({ estado: 'ok', revisadoEn: '2026-11-02T12:00:00.000Z' });
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('RF-2: si la consulta falla, el estado es error y NO lanza', async () => {
    const consulta = vi.fn().mockRejectedValue(new ErrorBaseDeDatosSalud('42P01'));
    const verificar = crearVerificadorDeSalud({ consulta, ahora: () => INICIO, registrar: vi.fn() });

    await expect(verificar()).resolves.toEqual({ estado: 'error', revisadoEn: '2026-11-02T12:00:00.000Z' });
  });

  it('RF-2: un rechazo que no es un Error (texto o undefined) también es error', async () => {
    for (const rechazo of ['boom', undefined, 42, null]) {
      const consulta = vi.fn().mockRejectedValue(rechazo);
      const verificar = crearVerificadorDeSalud({ consulta, ahora: () => INICIO, registrar: vi.fn() });
      await expect(verificar()).resolves.toMatchObject({ estado: 'error' });
    }
  });

  it('RF-3: el resultado solo tiene las claves estado y revisadoEn', async () => {
    const ok = crearVerificadorDeSalud({ consulta: vi.fn().mockResolvedValue(undefined), registrar: vi.fn() });
    const mal = crearVerificadorDeSalud({
      consulta: vi.fn().mockRejectedValue(new Error('detalle interno')),
      registrar: vi.fn(),
    });

    expect(Object.keys(await ok()).sort()).toEqual(['estado', 'revisadoEn']);
    expect(Object.keys(await mal()).sort()).toEqual(['estado', 'revisadoEn']);
  });

  it('usa la hora del sistema cuando no se le da un reloj', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15T08:30:00.000Z'));
    const verificar = crearVerificadorDeSalud({ consulta: vi.fn().mockResolvedValue(undefined), registrar: vi.fn() });

    expect((await verificar()).revisadoEn).toBe('2027-01-15T08:30:00.000Z');
  });

  // --- RF-4: registro de la causa -------------------------------------------------------
  it('RF-4: un fallo de la base se registra con causa base_de_datos y su código', async () => {
    const registrar = vi.fn();
    const verificar = crearVerificadorDeSalud({
      consulta: vi.fn().mockRejectedValue(new ErrorBaseDeDatosSalud('PGRST205')),
      ahora: () => INICIO,
      registrar,
    });

    await verificar();

    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledWith('health_db_error', { causa: 'base_de_datos', codigo: 'PGRST205' });
  });

  it('RF-4: un fallo sin código se registra solo con la causa', async () => {
    const registrar = vi.fn();
    const verificar = crearVerificadorDeSalud({
      consulta: vi.fn().mockRejectedValue(new ErrorBaseDeDatosSalud()),
      ahora: () => INICIO,
      registrar,
    });

    await verificar();

    expect(registrar).toHaveBeenCalledWith('health_db_error', { causa: 'base_de_datos' });
  });

  it('RF-4: la falta de variables se registra con causa configuracion', async () => {
    const registrar = vi.fn();
    const verificar = crearVerificadorDeSalud({
      consulta: vi.fn().mockRejectedValue(new ErrorConfiguracionSalud()),
      ahora: () => INICIO,
      registrar,
    });

    await verificar();

    expect(registrar).toHaveBeenCalledWith('health_db_error', { causa: 'configuracion' });
  });

  it('RF-4: un error desconocido se registra como base_de_datos SIN filtrar su mensaje', async () => {
    const registrar = vi.fn();
    const verificar = crearVerificadorDeSalud({
      consulta: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED https://proyecto-secreto.supabase.co key=abc123')),
      ahora: () => INICIO,
      registrar,
    });

    await verificar();

    expect(registrar).toHaveBeenCalledWith('health_db_error', { causa: 'base_de_datos' });
    const todo = JSON.stringify(registrar.mock.calls);
    expect(todo).not.toContain('proyecto-secreto');
    expect(todo).not.toContain('abc123');
  });

  it('RF-4: cuando todo va bien no se registra nada', async () => {
    const registrar = vi.fn();
    const verificar = crearVerificadorDeSalud({ consulta: vi.fn().mockResolvedValue(undefined), registrar });

    await verificar();

    expect(registrar).not.toHaveBeenCalled();
  });

  it('RF-4: por defecto registra con console.error', async () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {});
    const verificar = crearVerificadorDeSalud({ consulta: vi.fn().mockRejectedValue(new ErrorConfiguracionSalud()) });

    await verificar();

    expect(espia).toHaveBeenCalledWith('health_db_error', { causa: 'configuracion' });
  });

  // --- RF-6: tiempo límite --------------------------------------------------------------
  it('RF-6: a los 4 s vence: es error por timeout y se cancela la petición en curso', async () => {
    vi.useFakeTimers();
    const registrar = vi.fn();
    let senalRecibida: AbortSignal | undefined;
    const consulta = vi.fn((senal: AbortSignal) => {
      senalRecibida = senal;
      return new Promise<void>(() => {}); // nunca responde
    });
    const verificar = crearVerificadorDeSalud({ consulta, registrar });

    const pendiente = verificar();
    await vi.advanceTimersByTimeAsync(3_999);
    expect(senalRecibida?.aborted).toBe(false);
    expect(registrar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    const resultado = await pendiente;

    expect(resultado.estado).toBe('error');
    expect(senalRecibida?.aborted).toBe(true);
    expect(registrar).toHaveBeenCalledWith('health_db_error', { causa: 'timeout' });
  });

  it('RF-6: una respuesta tardía no cambia un timeout ya resuelto', async () => {
    vi.useFakeTimers();
    let responder!: () => void;
    const consulta = vi.fn(
      () =>
        new Promise<void>((resolver) => {
          responder = resolver;
        }),
    );
    const verificar = crearVerificadorDeSalud({ consulta, registrar: vi.fn() });

    const pendiente = verificar();
    await vi.advanceTimersByTimeAsync(4_000);
    expect((await pendiente).estado).toBe('error');

    responder(); // llega tarde
    await vi.advanceTimersByTimeAsync(1);

    expect((await verificar()).estado).toBe('error'); // sigue vigente el resultado del timeout
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('RF-6: si la consulta responde a tiempo no queda ningún temporizador pendiente', async () => {
    vi.useFakeTimers();
    const verificar = crearVerificadorDeSalud({ consulta: vi.fn().mockResolvedValue(undefined), registrar: vi.fn() });

    await verificar();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('RF-6: si la consulta falla tampoco queda ningún temporizador pendiente', async () => {
    vi.useFakeTimers();
    const verificar = crearVerificadorDeSalud({
      consulta: vi.fn().mockRejectedValue(new ErrorBaseDeDatosSalud()),
      registrar: vi.fn(),
    });

    await verificar();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('RF-6: si responde a tiempo, la señal de cancelación NO queda abortada', async () => {
    let senalRecibida: AbortSignal | undefined;
    const consulta = vi.fn(async (senal: AbortSignal) => {
      senalRecibida = senal;
    });
    const verificar = crearVerificadorDeSalud({ consulta, registrar: vi.fn() });

    await verificar();

    expect(senalRecibida?.aborted).toBe(false);
  });

  // --- RF-7: caché y consulta compartida -------------------------------------------------
  it('RF-7: con menos de 30 s reutiliza el resultado sin consultar otra vez', async () => {
    const reloj = relojFalso();
    const consulta = vi.fn().mockResolvedValue(undefined);
    const verificar = crearVerificadorDeSalud({ consulta, ahora: reloj.ahora, registrar: vi.fn() });

    const primero = await verificar();
    reloj.t += 29_999;
    const segundo = await verificar();

    expect(consulta).toHaveBeenCalledTimes(1);
    expect(segundo).toEqual(primero); // misma fecha de revisión: es el resultado guardado
  });

  it('RF-7: con 30 s exactos consulta de nuevo', async () => {
    const reloj = relojFalso();
    const consulta = vi.fn().mockResolvedValue(undefined);
    const verificar = crearVerificadorDeSalud({ consulta, ahora: reloj.ahora, registrar: vi.fn() });

    await verificar();
    reloj.t += 30_000;
    const segundo = await verificar();

    expect(consulta).toHaveBeenCalledTimes(2);
    expect(segundo.revisadoEn).toBe(new Date(INICIO + 30_000).toISOString());
  });

  it('RF-7: las solicitudes simultáneas comparten una sola consulta', async () => {
    let responder!: () => void;
    const consulta = vi.fn(
      () =>
        new Promise<void>((resolver) => {
          responder = resolver;
        }),
    );
    const verificar = crearVerificadorDeSalud({ consulta, ahora: () => INICIO, registrar: vi.fn() });

    const a = verificar();
    const b = verificar();
    const c = verificar();
    responder();
    const resultados = await Promise.all([a, b, c]);

    expect(consulta).toHaveBeenCalledTimes(1);
    expect(new Set(resultados.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it('RF-7: un error se reutiliza solo 5 s (para que el reintento de Monitoring a los 10 s consulte de verdad)', async () => {
    const reloj = relojFalso();
    const consulta = vi
      .fn()
      .mockRejectedValueOnce(new ErrorBaseDeDatosSalud())
      .mockResolvedValueOnce(undefined);
    const verificar = crearVerificadorDeSalud({ consulta, ahora: reloj.ahora, registrar: vi.fn() });

    expect((await verificar()).estado).toBe('error');
    reloj.t += 4_999;
    expect((await verificar()).estado).toBe('error'); // sigue el error guardado
    expect(consulta).toHaveBeenCalledTimes(1);

    reloj.t += 1; // 5 s exactos
    expect((await verificar()).estado).toBe('ok');
    expect(consulta).toHaveBeenCalledTimes(2);
  });

  it('RF-7: un error guardado no alarga la vigencia de un ok posterior (cada uno cuenta la suya)', async () => {
    const reloj = relojFalso();
    const consulta = vi
      .fn()
      .mockRejectedValueOnce(new ErrorBaseDeDatosSalud())
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const verificar = crearVerificadorDeSalud({ consulta, ahora: reloj.ahora, registrar: vi.fn() });

    await verificar(); // error
    reloj.t += 5_000;
    await verificar(); // ok (nueva consulta)
    reloj.t += 29_999;
    await verificar(); // el ok sigue vigente
    expect(consulta).toHaveBeenCalledTimes(2);

    reloj.t += 1; // el ok cumple 30 s
    await verificar();
    expect(consulta).toHaveBeenCalledTimes(3);
  });

  it('RF-7: tras terminar una consulta compartida, la siguiente (vencida la vigencia) empieza una nueva', async () => {
    const reloj = relojFalso();
    const consulta = vi.fn().mockResolvedValue(undefined);
    const verificar = crearVerificadorDeSalud({ consulta, ahora: reloj.ahora, registrar: vi.fn() });

    await Promise.all([verificar(), verificar()]);
    reloj.t += 60_000;
    await verificar();

    expect(consulta).toHaveBeenCalledTimes(2);
  });

  it('cada verificador tiene su propia caché (no comparten estado)', async () => {
    const consultaA = vi.fn().mockResolvedValue(undefined);
    const consultaB = vi.fn().mockResolvedValue(undefined);
    const a = crearVerificadorDeSalud({ consulta: consultaA, ahora: () => INICIO, registrar: vi.fn() });
    const b = crearVerificadorDeSalud({ consulta: consultaB, ahora: () => INICIO, registrar: vi.fn() });

    await a();
    await b();

    expect(consultaA).toHaveBeenCalledTimes(1);
    expect(consultaB).toHaveBeenCalledTimes(1);
  });
});
