/**
 * @file lib/salud/__tests__/consulta-supabase.test.ts
 * @description Pruebas de la consulta mínima a Supabase (SPEC — health-db, RF-5 y RNF-1/RNF-2).
 *
 * El cliente de Supabase se reemplaza por uno falso que registra con qué se lo llama:
 * así se comprueba que la consulta es fija, de solo lectura y sin traer filas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@rcp/shared/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@rcp/shared/db')>();
  return { ...original, crearClienteSupabase: vi.fn() };
});

// Import DESPUÉS del mock: la consulta usa el `crearClienteSupabase` falso.
import { crearClienteSupabase } from '@rcp/shared/db';
import { consultarSupabase } from '../consulta-supabase';
import { ErrorBaseDeDatosSalud, ErrorConfiguracionSalud } from '../errores';

const crearClienteMock = vi.mocked(crearClienteSupabase);

/** Cliente falso con la cadena `from → select → limit → abortSignal → retry` que usa la consulta. */
function clienteFalso(resultado: { error: { code?: string; message: string } | null }) {
  const retry = vi.fn().mockResolvedValue(resultado);
  const abortSignal = vi.fn().mockReturnValue({ retry });
  const limit = vi.fn().mockReturnValue({ abortSignal });
  const select = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ select });
  crearClienteMock.mockReturnValue({ from } as unknown as ReturnType<typeof crearClienteSupabase>);
  return { from, select, limit, abortSignal, retry };
}

describe('consultarSupabase', () => {
  beforeEach(() => {
    crearClienteMock.mockReset();
    vi.stubEnv('SUPABASE_URL', 'https://proyecto-de-prueba.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'clave-de-prueba-no-real');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('RF-5: consulta usuarios con select id y limit 0 (sin traer filas), cancelable con la señal', async () => {
    const falso = clienteFalso({ error: null });
    const senal = new AbortController().signal;

    await expect(consultarSupabase(senal)).resolves.toBeUndefined();

    expect(falso.from).toHaveBeenCalledWith('usuarios');
    expect(falso.limit).toHaveBeenCalledWith(0);
    expect(falso.abortSignal).toHaveBeenCalledWith(senal);
  });

  it('RF-5: pide solo la columna id, SIN la opción head', async () => {
    // Con `head: true`, postgrest-js trata un 404 sin cuerpo (tabla inexistente) como éxito:
    // la base parecería sana aunque faltara el esquema. Por eso la consulta es un GET con limit 0.
    const falso = clienteFalso({ error: null });

    await consultarSupabase(new AbortController().signal);

    expect(falso.select).toHaveBeenCalledTimes(1);
    expect(falso.select).toHaveBeenCalledWith('id');
  });

  it('RF-6: desactiva los reintentos internos de postgrest-js', async () => {
    // Con los reintentos activos, una base inalcanzable tardaba hasta el tiempo límite
    // (esperas de 1, 2 y 4 s) y se clasificaba mal como timeout. La sonda debe decir la verdad al instante.
    const falso = clienteFalso({ error: null });

    await consultarSupabase(new AbortController().signal);

    expect(falso.retry).toHaveBeenCalledWith(false);
  });

  it('RNF-2: crea el cliente con la URL y la clave del entorno del servidor', async () => {
    clienteFalso({ error: null });

    await consultarSupabase(new AbortController().signal);

    expect(crearClienteMock).toHaveBeenCalledWith({
      url: 'https://proyecto-de-prueba.supabase.co',
      serviceRoleKey: 'clave-de-prueba-no-real',
    });
  });

  it('RF-2: si Supabase devuelve un error, rechaza con el código y SIN el mensaje original', async () => {
    clienteFalso({ error: { code: 'PGRST205', message: 'relation proyecto-secreto.usuarios does not exist' } });

    const rechazo = await consultarSupabase(new AbortController().signal).catch((e: unknown) => e);

    expect(rechazo).toBeInstanceOf(ErrorBaseDeDatosSalud);
    expect((rechazo as ErrorBaseDeDatosSalud).codigo).toBe('PGRST205');
    expect((rechazo as ErrorBaseDeDatosSalud).message).not.toContain('proyecto-secreto');
  });

  it('RF-2: un error de Supabase sin código también rechaza', async () => {
    clienteFalso({ error: { message: 'fetch failed' } });

    const rechazo = await consultarSupabase(new AbortController().signal).catch((e: unknown) => e);

    expect(rechazo).toBeInstanceOf(ErrorBaseDeDatosSalud);
    expect((rechazo as ErrorBaseDeDatosSalud).codigo).toBeUndefined();
  });

  it('RF-2: si faltan las variables, rechaza con ErrorConfiguracionSalud y no crea el cliente', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const rechazo = await consultarSupabase(new AbortController().signal).catch((e: unknown) => e);

    expect(rechazo).toBeInstanceOf(ErrorConfiguracionSalud);
    expect(crearClienteMock).not.toHaveBeenCalled();
  });

  it('RF-2: si falta solo una de las dos variables, también es error de configuración', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const rechazo = await consultarSupabase(new AbortController().signal).catch((e: unknown) => e);

    expect(rechazo).toBeInstanceOf(ErrorConfiguracionSalud);
  });
});
