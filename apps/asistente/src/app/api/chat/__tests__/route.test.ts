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
  model: 'gemini-2.5-flash',
  finishReason: 'STOP',
};

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'clave-de-prueba-no-real-1234567890');
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash');
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

  it('llama a Gemini con el historial recibido y el mensaje nuevo al final', async () => {
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

    // El prompt de sistema va primero, luego el historial completo, luego
    // el mensaje nuevo al final.
    expect(mensajesEnviados[0].role).toBe('user');
    expect(mensajesEnviados.slice(1, 3)).toEqual(historial);
    expect(mensajesEnviados.at(-1)).toEqual({
      role: 'user',
      parts: [{ text: 'Continuemos la conversación' }],
    });
  });

  it('pasa el timeout de 5s y el modelo de GEMINI_MODEL a callGemini', async () => {
    await POST(crearRequest({ usuario_id: uuidDePrueba(), mensaje: 'Hola' }));

    const [, , opciones] = callGeminiMock.mock.calls[0];
    expect(opciones).toMatchObject({ timeout: 5000, model: 'gemini-2.5-flash' });
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
});
