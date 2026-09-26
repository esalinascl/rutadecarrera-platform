/**
 * @file api/chat/__tests__/route.test.ts
 * @description Tests del endpoint POST /api/chat (TASK 5)
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

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

describe('POST /api/chat', () => {
  it('responde 200 con una estructura ChatResponse válida ante un request válido', async () => {
    const request = crearRequest({
      usuario_id: uuidDePrueba(),
      mensaje: 'Hola, necesito ayuda con mi transición profesional',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      respuesta: expect.any(String),
      tokens_used: expect.any(Number),
      id_mensaje: expect.any(String),
      conversacion_id: expect.any(String),
      timestamp: expect.any(String),
    });
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
});
