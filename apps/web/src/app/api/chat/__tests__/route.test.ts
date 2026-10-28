/**
 * @file api/chat/__tests__/route.test.ts
 * @description Tests del endpoint POST /api/chat (TASK 5 + TASK 6)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@rcp/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@rcp/shared')>();
  return {
    ...original,
    callGemini: vi.fn(),
  };
});

// Import DESPUÉS del mock: POST usa el `callGemini` mockeado.
import { POST } from '../route';
import { callGemini, GeminiError } from '@rcp/shared';

const callGeminiMock = vi.mocked(callGemini);

function crearRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** UUID v4 único por test, para no compartir el contador de rate limit. */
function uuidDePrueba(): string {
  return crypto.randomUUID();
}

const RESPUESTA_GEMINI_OK = {
  response: 'Basado en tu perfil, te recomiendo enfocarte en...',
  tokensUsed: 128,
  model: 'gemini-3.8-flash',
  finishReason: 'STOP',
};

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'clave-de-prueba-no-real-1234567890');
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.8-flash');
    callGeminiMock.mockReset();
    callGeminiMock.mockResolvedValue(RESPUESTA_GEMINI_OK);
  });

  it('responde 200 con una estructura ChatResponse válida, con datos reales de Gemini', async () => {
    const request = crearRequest({
      usuario_id: uuidDePrueba(),
      mensaje: 'Hola, necesito ayuda con mi transición profesional',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      respuesta: RESPUESTA_GEMINI_OK.response,
      tokens_used: RESPUESTA_GEMINI_OK.tokensUsed,
      id_mensaje: expect.any(String),
      conversacion_id: expect.any(String),
      timestamp: expect.any(String),
    });
  });

  it('funde el prompt de sistema con el primer turno del historial cuando ambos son "user" (Gemini exige turnos alternados)', async () => {
    const historial = [
      { role: 'user' as const, parts: [{ text: 'Mensaje anterior del usuario' }] },
      { role: 'model' as const, parts: [{ text: 'Respuesta anterior del asistente' }] },
    ];

    await POST(
      crearRequest({
        usuario_id: uuidDePrueba(),
        mensaje: 'Continuemos la conversación',
        historial,
      }),
    );

    expect(callGeminiMock).toHaveBeenCalledTimes(1);
    const [mensajesEnviados] = callGeminiMock.mock.calls[0];

    // El prompt de sistema (turno "user") y el primer turno del historial
    // (también "user") se funden en una sola entrada en vez de mandarse como
    // dos turnos "user" seguidos — Gemini puede rechazar eso con 400.
    expect(mensajesEnviados).toHaveLength(3);
    expect(mensajesEnviados[0].role).toBe('user');
    expect(mensajesEnviados[0].parts.at(-1)).toEqual({ text: 'Mensaje anterior del usuario' });
    expect(mensajesEnviados[1]).toEqual(historial[1]);
    expect(mensajesEnviados.at(-1)).toEqual({
      role: 'user',
      parts: [{ text: 'Continuemos la conversación' }],
    });

    // Regla general: ningún par de turnos consecutivos comparte el mismo rol.
    for (let i = 1; i < mensajesEnviados.length; i++) {
      expect(mensajesEnviados[i].role).not.toBe(mensajesEnviados[i - 1].role);
    }
  });

  it('funde el prompt de sistema con el mensaje nuevo cuando no hay historial (mismo motivo)', async () => {
    await POST(crearRequest({ usuario_id: uuidDePrueba(), mensaje: 'Hola, primera vez' }));

    const [mensajesEnviados] = callGeminiMock.mock.calls[0];

    // Sin historial, el prompt de sistema y el mensaje nuevo son ambos
    // "user" — deben fundirse en un solo turno, no mandarse por separado.
    expect(mensajesEnviados).toHaveLength(1);
    expect(mensajesEnviados[0].role).toBe('user');
    expect(mensajesEnviados[0].parts.at(-1)).toEqual({ text: 'Hola, primera vez' });
  });

  it('pasa el timeout de 5s y el modelo de GEMINI_MODEL a callGemini', async () => {
    await POST(crearRequest({ usuario_id: uuidDePrueba(), mensaje: 'Hola' }));

    const [, , opciones] = callGeminiMock.mock.calls[0];
    expect(opciones).toMatchObject({ timeout: 5000, model: 'gemini-3.8-flash' });
  });

  it('usa el conversacion_id recibido en vez de generar uno nuevo', async () => {
    const conversacionId = uuidDePrueba();
    const request = crearRequest({
      usuario_id: uuidDePrueba(),
      conversacion_id: conversacionId,
      mensaje: 'Continuemos la conversación anterior',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.conversacion_id).toBe(conversacionId);
  });

  it('responde 400 cuando el mensaje está vacío', async () => {
    const request = crearRequest({ usuario_id: uuidDePrueba(), mensaje: '' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it('responde 400 cuando usuario_id no es un UUID válido', async () => {
    const request = crearRequest({ usuario_id: 'no-es-un-uuid', mensaje: 'Hola' });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('responde 400 cuando el cuerpo no es JSON válido', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: '{esto no es json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('responde 429 cuando se excede el límite de 60 solicitudes por minuto', async () => {
    const usuarioId = uuidDePrueba();

    for (let i = 0; i < 60; i++) {
      await POST(crearRequest({ usuario_id: usuarioId, mensaje: `Mensaje ${i}` }));
    }

    const response = await POST(crearRequest({ usuario_id: usuarioId, mensaje: 'Este debería fallar' }));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toMatch(/límite/i);
  });

  it('responde 500 sin filtrar detalles internos cuando Gemini falla (p.ej. timeout)', async () => {
    callGeminiMock.mockRejectedValueOnce(
      new GeminiError('Gemini API timeout (> 5000ms)', 'TIMEOUT', 504),
    );

    const response = await POST(crearRequest({ usuario_id: uuidDePrueba(), mensaje: 'Hola' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Error interno del servidor' });
    // No debe filtrar el código interno ni el mensaje real del error de Gemini.
    expect(JSON.stringify(data)).not.toMatch(/TIMEOUT|5000ms/);
  });

  it('responde 500 sin llamar a Gemini cuando falta GEMINI_API_KEY', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');

    const response = await POST(crearRequest({ usuario_id: uuidDePrueba(), mensaje: 'Hola' }));

    expect(response.status).toBe(500);
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it('responde 500 sin llamar a Gemini cuando falta GEMINI_MODEL (evita caer en el default descontinuado de @rcp/shared)', async () => {
    vi.stubEnv('GEMINI_MODEL', '');

    const response = await POST(crearRequest({ usuario_id: uuidDePrueba(), mensaje: 'Hola' }));

    expect(response.status).toBe(500);
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it('sanitiza la respuesta de Gemini antes de devolverla al cliente (no filtra secretos)', async () => {
    callGeminiMock.mockResolvedValueOnce({
      response: 'Tu API key es sk-abcd12345678, no la compartas con nadie.',
      tokensUsed: 50,
      model: 'gemini-3.8-flash',
      finishReason: 'STOP',
    });

    const response = await POST(crearRequest({ usuario_id: uuidDePrueba(), mensaje: 'Hola' }));
    const data = await response.json();

    expect(data.respuesta).not.toMatch(/sk-abcd12345678/);
    expect(data.respuesta).toMatch(/\[REDACTED\]/);
  });
});

describe('POST /api/chat — tope de tamaño del cuerpo (GHSA-mrhx-c7xc-m3w5)', () => {
  /** Tope acordado: 512 KB. Se repite aquí a propósito: si alguien lo cambia, estas pruebas obligan a decidirlo. */
  const LIMITE_BYTES = 512 * 1024;

  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'clave-de-prueba-no-real-1234567890');
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.8-flash');
    callGeminiMock.mockReset();
    callGeminiMock.mockResolvedValue(RESPUESTA_GEMINI_OK);
  });

  function crearRequestCrudo(texto: string, encabezados: Record<string, string> = {}): NextRequest {
    return new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: texto,
      headers: { 'Content-Type': 'application/json', ...encabezados },
    });
  }

  /** JSON válido de la petición, rellenado con espacios hasta ocupar exactamente `bytes` bytes. */
  function cuerpoDeBytes(bytes: number): string {
    const base = JSON.stringify({ usuario_id: uuidDePrueba(), mensaje: 'Hola' });
    return base + ' '.repeat(bytes - Buffer.byteLength(base));
  }

  it('acepta un cuerpo válido que ocupa exactamente el tope', async () => {
    const response = await POST(crearRequestCrudo(cuerpoDeBytes(LIMITE_BYTES)));
    expect(response.status).toBe(200);
  });

  it('rechaza con 413 un cuerpo un byte más grande que el tope, sin llamar a Gemini', async () => {
    const response = await POST(crearRequestCrudo(cuerpoDeBytes(LIMITE_BYTES + 1)));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'El cuerpo de la solicitud es demasiado grande' });
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it('rechaza con 413 cuando el Content-Length declarado supera el tope (aunque el cuerpo real sea chico)', async () => {
    const request = crearRequestCrudo(cuerpoDeBytes(100), { 'content-length': String(LIMITE_BYTES + 1) });
    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it('rechaza con 413 el ataque de ~4 MB: un historial con millones de elementos inválidos', async () => {
    const elementos = 2_200_000;
    const cuerpo = `{"usuario_id":"${uuidDePrueba()}","mensaje":"hola","historial":[${'1,'.repeat(elementos - 1)}1]}`;
    expect(Buffer.byteLength(cuerpo)).toBeLessThan(4.5 * 1024 * 1024); // cabe en el tope de 4,5 MB de Vercel

    const response = await POST(crearRequestCrudo(cuerpo));

    expect(response.status).toBe(413);
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it('un cuerpo que no es JSON sigue respondiendo 400 (no 413)', async () => {
    const response = await POST(crearRequestCrudo('{esto no es json'));
    expect(response.status).toBe(400);
  });
});

