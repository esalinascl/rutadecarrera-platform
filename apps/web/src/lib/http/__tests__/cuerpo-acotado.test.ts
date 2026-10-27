/**
 * @file lib/http/__tests__/cuerpo-acotado.test.ts
 * @description Tests de la lectura del cuerpo JSON con tope de tamaño (GHSA-mrhx-c7xc-m3w5).
 * Se escriben ANTES de la implementación (TDD, mandato #3).
 */

import { describe, it, expect } from 'vitest';
import {
  leerJsonAcotado,
  MAX_CUERPO_BYTES,
  MENSAJE_CUERPO_GRANDE,
  MENSAJE_JSON_INVALIDO,
} from '../cuerpo-acotado';

const URL_PRUEBA = 'http://localhost/prueba';

function peticion(cuerpo: BodyInit | null, encabezados: Record<string, string> = {}): Request {
  return new Request(URL_PRUEBA, { method: 'POST', body: cuerpo, headers: encabezados });
}

interface Registro {
  leidos: number;
  cancelado: boolean;
}

/**
 * Cuerpo por trozos de espacios en blanco; cuenta cuántos trozos se leyeron.
 * `highWaterMark: 0` hace que el flujo NO lea por adelantado: solo produce un trozo cuando alguien lo pide,
 * así `registro.leidos` mide lo que de verdad leyó quien consume el cuerpo.
 */
function cuerpoPorTrozos(cantidad: number, bytesPorTrozo: number, registro: Registro): ReadableStream<Uint8Array> {
  let siguiente = 0;
  return new ReadableStream<Uint8Array>(
    {
      pull(controlador) {
        if (siguiente >= cantidad) {
          controlador.close();
          return;
        }
        siguiente += 1;
        registro.leidos = siguiente;
        controlador.enqueue(new Uint8Array(bytesPorTrozo).fill(0x20));
      },
      cancel() {
        registro.cancelado = true;
      },
    },
    new CountQueuingStrategy({ highWaterMark: 0 }),
  );
}

function peticionPorTrozos(cuerpo: ReadableStream<Uint8Array>, encabezados: Record<string, string> = {}): Request {
  // Los cuerpos en flujo exigen `duplex: 'half'` (no está en los tipos de RequestInit).
  return new Request(URL_PRUEBA, { method: 'POST', body: cuerpo, headers: encabezados, duplex: 'half' } as RequestInit);
}

describe('leerJsonAcotado — casos normales', () => {
  it('lee un JSON válido', async () => {
    expect(await leerJsonAcotado(peticion('{"a":1}'), 1000)).toEqual({ ok: true, datos: { a: 1 } });
  });

  it('decodifica UTF-8 con acentos y eñes', async () => {
    const lectura = await leerJsonAcotado(peticion('{"a":"ñandú"}'), 1000);
    expect(lectura).toEqual({ ok: true, datos: { a: 'ñandú' } });
  });

  it('no valida la forma del JSON: devuelve null o arreglos tal cual (eso lo hace el esquema)', async () => {
    expect(await leerJsonAcotado(peticion('null'), 1000)).toEqual({ ok: true, datos: null });
    expect(await leerJsonAcotado(peticion('[1,2]'), 1000)).toEqual({ ok: true, datos: [1, 2] });
  });

  it('un Content-Length ilegible no bloquea: se valida con los bytes reales', async () => {
    const lectura = await leerJsonAcotado(peticion('{"a":1}', { 'content-length': 'abc' }), 1000);
    expect(lectura.ok).toBe(true);
  });

  it('el tope por defecto es 512 KB', () => {
    expect(MAX_CUERPO_BYTES).toBe(512 * 1024);
  });
});

describe('leerJsonAcotado — 400', () => {
  it('JSON inválido', async () => {
    expect(await leerJsonAcotado(peticion('{esto no es json'), 1000)).toEqual({
      ok: false,
      estado: 400,
      error: MENSAJE_JSON_INVALIDO,
    });
  });

  it('cuerpo vacío', async () => {
    const lectura = await leerJsonAcotado(peticion(''), 1000);
    expect(lectura).toMatchObject({ ok: false, estado: 400 });
  });

  it('petición sin cuerpo', async () => {
    const lectura = await leerJsonAcotado(new Request(URL_PRUEBA, { method: 'POST' }), 1000);
    expect(lectura).toMatchObject({ ok: false, estado: 400 });
  });

  it('el cliente corta la conexión a mitad del cuerpo', async () => {
    const cuerpo = new ReadableStream<Uint8Array>({
      pull(controlador) {
        controlador.error(new Error('conexión abortada'));
      },
    });
    const lectura = await leerJsonAcotado(peticionPorTrozos(cuerpo), 1000);
    expect(lectura).toMatchObject({ ok: false, estado: 400 });
  });
});

describe('leerJsonAcotado — 413', () => {
  it('acepta exactamente el tope y rechaza un byte más', async () => {
    const exacto = `"${'a'.repeat(98)}"`; // 100 bytes
    expect(Buffer.byteLength(exacto)).toBe(100);
    expect((await leerJsonAcotado(peticion(exacto), 100)).ok).toBe(true);

    const unoMas = `"${'a'.repeat(99)}"`; // 101 bytes
    expect(await leerJsonAcotado(peticion(unoMas), 100)).toEqual({
      ok: false,
      estado: 413,
      error: MENSAJE_CUERPO_GRANDE,
    });
  });

  it('cuenta bytes, no caracteres (una eñe son 2 bytes)', async () => {
    const texto = `"${'ñ'.repeat(60)}"`; // 62 caracteres, 122 bytes
    expect(texto.length).toBeLessThan(100);
    expect(Buffer.byteLength(texto)).toBeGreaterThan(100);
    expect(await leerJsonAcotado(peticion(texto), 100)).toMatchObject({ ok: false, estado: 413 });
  });

  it('un Content-Length igual al tope se acepta; uno mayor se rechaza', async () => {
    const exacto = `"${'a'.repeat(98)}"`; // 100 bytes
    expect((await leerJsonAcotado(peticion(exacto, { 'content-length': '100' }), 100)).ok).toBe(true);
    expect(await leerJsonAcotado(peticion(exacto, { 'content-length': '101' }), 100)).toMatchObject({
      ok: false,
      estado: 413,
    });
  });

  it('si el Content-Length declarado supera el tope, responde 413 SIN leer el cuerpo', async () => {
    const registro: Registro = { leidos: 0, cancelado: false };
    const cuerpo = cuerpoPorTrozos(10, 100, registro);
    const lectura = await leerJsonAcotado(peticionPorTrozos(cuerpo, { 'content-length': '1000' }), 100);

    expect(lectura).toMatchObject({ ok: false, estado: 413 });
    expect(registro.leidos).toBe(0);
  });

  it('si el Content-Length miente (dice 10 y manda 5000), igual se corta al pasar el tope real', async () => {
    const real = `"${'a'.repeat(4998)}"`;
    const lectura = await leerJsonAcotado(peticion(real, { 'content-length': '10' }), 1000);
    expect(lectura).toMatchObject({ ok: false, estado: 413 });
  });

  it('sin Content-Length (cuerpo por trozos) corta y cancela la lectura al pasar el tope', async () => {
    const registro: Registro = { leidos: 0, cancelado: false };
    const cuerpo = cuerpoPorTrozos(100, 100, registro);
    const lectura = await leerJsonAcotado(peticionPorTrozos(cuerpo), 450);

    expect(lectura).toMatchObject({ ok: false, estado: 413 });
    expect(registro.cancelado).toBe(true);
    expect(registro.leidos).toBeLessThan(20); // de 100 trozos posibles, no se leyó casi nada
  });
});
