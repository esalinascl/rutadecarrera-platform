/**
 * @file app/api/chat/route.ts
 * @description Endpoint de chat del asistente (TASK 5).
 *
 * Por ahora responde un mock, sin llamar a Gemini todavía (eso es TASK 6).
 * Ya deja resuelto: validación con el schema compartido, rate limiting, y el
 * contrato exacto de respuesta que espera el frontend (ChatResponse).
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { chatRequestSchema, safeValidate, type ChatResponse } from '@rcp/shared';

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Rate limiting en memoria, por `usuario_id`.
 *
 * ⚠️ Limitación conocida: se resetea si el proceso se reinicia, y no se
 * comparte entre instancias serverless concurrentes (no hay Redis en el
 * stack todavía, ver PLAN §Deployment — "Caching de respuestas Gemini: por
 * definir en TASK 24"). Suficiente para esta fase; reemplazar antes de un
 * despliegue con tráfico real en múltiples instancias.
 */
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function verificarLimite(usuarioId: string): boolean {
  const ahora = Date.now();
  const entrada = requestCounts.get(usuarioId);

  if (!entrada || ahora > entrada.resetAt) {
    requestCounts.set(usuarioId, { count: 1, resetAt: ahora + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entrada.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entrada.count += 1;
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let cuerpo: unknown;

  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'JSON inválido en el cuerpo de la solicitud' },
      { status: 400 },
    );
  }

  const validacion = safeValidate(cuerpo, chatRequestSchema);

  if (!validacion.valido) {
    return NextResponse.json(
      { error: 'Solicitud inválida', detalles: validacion.error },
      { status: 400 },
    );
  }

  const { usuario_id, conversacion_id, mensaje } = validacion.datos;

  if (!verificarLimite(usuario_id)) {
    return NextResponse.json(
      { error: 'Límite de solicitudes excedido. Intenta de nuevo en un minuto.' },
      { status: 429 },
    );
  }

  try {
    // TODO(TASK 6): reemplazar este mock por la llamada real a Gemini
    // (`callGemini` de @rcp/shared/utils/gemini).
    const respuesta: ChatResponse = {
      respuesta: `Recibí tu mensaje: "${mensaje}". La integración con Gemini llega en la siguiente tarea.`,
      tokens_used: 0,
      id_mensaje: randomUUID(),
      conversacion_id: conversacion_id ?? randomUUID(),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    console.error('Error inesperado en /api/chat:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
