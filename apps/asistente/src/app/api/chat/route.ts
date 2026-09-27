/**
 * @file app/api/chat/route.ts
 * @description Endpoint de chat del asistente.
 *
 * TASK 5: esqueleto + validación + rate limiting (mock, sin Gemini).
 * TASK 6 (este cambio): conectado a Gemini real vía @rcp/shared/utils/gemini.
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  chatRequestSchema,
  safeValidate,
  callGemini,
  formatGeminiPrompt,
  sanitizeGeminiResponse,
  GeminiError,
  type ChatResponse,
  type GeminiMessage,
} from '@rcp/shared';

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
/** Criterio de aceptación de TASK 6: timeout de 5s para la llamada a Gemini. */
const GEMINI_TIMEOUT_MS = 5_000;

/**
 * Rate limiting en memoria, por `usuario_id`.
 *
 * ⚠️ Limitaciones conocidas, documentadas en el issue #9:
 * - Se resetea si el proceso se reinicia, y no se comparte entre instancias
 *   serverless concurrentes (no hay Redis en el stack todavía).
 * - `usuario_id` solo se valida como UUID sintáctico, no contra una sesión
 *   real (no hay autenticación todavía, ver TASK 9) — un cliente puede
 *   evadir el límite generando un UUID nuevo por request.
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

/**
 * Gemini exige turnos con roles alternados ("user"/"model"): dos turnos
 * consecutivos del mismo rol pueden ser rechazados con 400 INVALID_ARGUMENT.
 * El prompt de sistema se antepone como turno "user" (ver TODO más abajo),
 * lo que puede quedar pegado a otro turno "user" — sin historial (se pega al
 * mensaje nuevo) o con un historial que empieza en "user". Se fusionan los
 * turnos consecutivos del mismo rol en una sola entrada en vez de enviarlos
 * por separado (hallazgo de revisión independiente antes de mergear TASK 6).
 */
function fusionarTurnosConsecutivos(mensajes: GeminiMessage[]): GeminiMessage[] {
  const fusionados: GeminiMessage[] = [];

  for (const mensaje of mensajes) {
    const anterior = fusionados[fusionados.length - 1];
    if (anterior && anterior.role === mensaje.role) {
      anterior.parts = [...anterior.parts, ...mensaje.parts];
    } else {
      fusionados.push({ role: mensaje.role, parts: [...mensaje.parts] });
    }
  }

  return fusionados;
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

  const { usuario_id, conversacion_id, mensaje, contexto, historial } = validacion.datos;

  if (!verificarLimite(usuario_id)) {
    return NextResponse.json(
      { error: 'Límite de solicitudes excedido. Intenta de nuevo en un minuto.' },
      { status: 429 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // No exponer al cliente que falta configuración del servidor.
    console.error('GEMINI_API_KEY no está configurada en el entorno');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }

  // Igual que GEMINI_API_KEY: si GEMINI_MODEL falta, fallar explícito en vez
  // de dejar que @rcp/shared/utils/gemini caiga en su default ('gemini-pro'),
  // modelo que Google ya descontinuó (ver docs/decisions/001-gemini-integration.md).
  // Sin este chequeo, un ambiente mal configurado fallaría en silencio contra
  // un modelo inválido en vez de dar un error claro en los logs.
  const model = process.env.GEMINI_MODEL;

  if (!model) {
    console.error('GEMINI_MODEL no está configurado en el entorno');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }

  try {
    // El helper compartido no tiene un rol "system" nativo separado del
    // historial (Gemini sí lo soporta vía `systemInstruction`, pero
    // @rcp/shared/utils/gemini todavía no lo expone) — se antepone el
    // prompt de sistema como el primer mensaje "user".
    // TODO(deuda técnica): si callGemini agrega soporte a systemInstruction
    // nativo, migrar esto y dejar de duplicar el rol "user" al inicio.
    const mensajesGemini = fusionarTurnosConsecutivos([
      { role: 'user', parts: [{ text: formatGeminiPrompt(contexto) }] },
      ...(historial ?? []),
      { role: 'user', parts: [{ text: mensaje }] },
    ]);

    const respuestaGemini = sanitizeGeminiResponse(
      await callGemini(mensajesGemini, apiKey, {
        timeout: GEMINI_TIMEOUT_MS,
        model,
      }),
    );

    // Logging de tokens (criterio de aceptación de TASK 6). No es
    // persistencia — eso es TASK 7+, solo observabilidad en logs de Vercel.
    console.log(
      JSON.stringify({
        evento: 'gemini_tokens_used',
        usuario_id,
        tokens_used: respuestaGemini.tokensUsed,
        model: respuestaGemini.model,
      }),
    );

    const respuesta: ChatResponse = {
      respuesta: respuestaGemini.response,
      tokens_used: respuestaGemini.tokensUsed,
      id_mensaje: randomUUID(),
      conversacion_id: conversacion_id ?? randomUUID(),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    // No propagar error.message de GeminiError al cliente: puede incluir
    // detalles internos (ver issue #9, punto 2 — antes esta rama no tenía
    // ningún test porque era código inalcanzable con la respuesta mock).
    if (error instanceof GeminiError) {
      console.error(`Error de Gemini (${error.code}):`, error.message);
    } else {
      console.error('Error inesperado en /api/chat:', error);
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
