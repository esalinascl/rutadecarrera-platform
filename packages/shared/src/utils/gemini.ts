/**
 * @file utils/gemini.ts
 * @description Helpers para interactuar con Google Gemini API
 *
 * Proporciona funciones para:
 * - Llamar Gemini API con manejo de errores
 * - Formatear prompts del sistema
 * - Extraer análisis de conversaciones
 * - Gestionar tokens y timeouts
 */

import type {
  GeminiMessage,
  GeminiCallOptions,
  GeminiResponse,
  AnalysisResult,
  ContextoInicial,
  Message,
} from '../types';

/**
 * Error específico de Gemini
 */
export class GeminiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/**
 * Valida la API key de Gemini
 *
 * @param apiKey - API key a validar
 * @throws GeminiError si la key es inválida
 *
 * @example
 * validateGeminiApiKey(process.env.GEMINI_API_KEY!);
 */
export function validateGeminiApiKey(apiKey: string): void {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new GeminiError(
      'GEMINI_API_KEY no está configurada o es inválida',
      'MISSING_API_KEY',
      400,
    );
  }

  if (apiKey.length < 20) {
    throw new GeminiError(
      'GEMINI_API_KEY parece ser inválida (muy corta)',
      'INVALID_API_KEY_FORMAT',
      400,
    );
  }
}

/**
 * Llama a Gemini API con manejo completo de errores
 *
 * @param messages - Array de mensajes (historial + mensaje actual)
 * @param apiKey - API key de Gemini
 * @param options - Opciones de configuración
 * @returns Respuesta de Gemini con metadata
 * @throws GeminiError en caso de error
 *
 * @example
 * const respuesta = await callGemini(
 *   [{ role: 'user', parts: [{ text: 'Hola' }] }],
 *   process.env.GEMINI_API_KEY!,
 *   { temperature: 0.7, maxTokens: 500, timeout: 5000 }
 * );
 * console.log(respuesta.response);
 */
export async function callGemini(
  messages: GeminiMessage[],
  apiKey: string,
  options?: GeminiCallOptions,
): Promise<GeminiResponse> {
  // Validaciones previas
  validateGeminiApiKey(apiKey);

  if (!messages || messages.length === 0) {
    throw new GeminiError(
      'Debes proporcionar al menos un mensaje',
      'EMPTY_MESSAGES',
      400,
    );
  }

  const {
    temperature = 0.7,
    maxTokens = 2048,
    timeout = 5000,
    model = 'gemini-pro',
    topK = 40,
    topP = 0.95,
  } = options || {};

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Preparar payload
  const payload = {
    contents: messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: msg.parts,
    })),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topK,
      topP,
    },
  };

  try {
    // Crear abort controller para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Realizar request
    const response = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Manejar respuesta
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

      throw new GeminiError(
        `Error de Gemini API: ${errorMessage}`,
        'API_ERROR',
        response.status,
      );
    }

    const data = await response.json();

    // Extraer respuesta y tokens
    const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const usageMetadata = data.usageMetadata || {};

    if (!respuesta) {
      throw new GeminiError(
        'Gemini no retornó una respuesta válida',
        'INVALID_RESPONSE',
        500,
      );
    }

    return {
      response: respuesta,
      tokensUsed: usageMetadata.totalTokenCount || 0,
      model,
      finishReason: data.candidates?.[0]?.finishReason,
    };
  } catch (error) {
    // Re-lanzar GeminiError si ya es uno
    if (error instanceof GeminiError) {
      throw error;
    }

    // Manejar timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GeminiError(
        `Gemini API timeout (> ${timeout}ms)`,
        'TIMEOUT',
        504,
      );
    }

    // Error genérico
    const message = error instanceof Error ? error.message : 'Error desconocido';
    throw new GeminiError(
      `Error al llamar Gemini: ${message}`,
      'UNKNOWN_ERROR',
      500,
    );
  }
}

/**
 * Formatea un prompt del sistema con contexto inicial
 *
 * @param contexto - Contexto inicial del usuario
 * @returns String con prompt formateado
 *
 * @example
 * const systemPrompt = formatGeminiPrompt({
 *   situacion: "Desempleado",
 *   objetivo: "Conseguir trabajo en tech"
 * });
 */
export function formatGeminiPrompt(contexto?: ContextoInicial): string {
  const basePrompt = `Eres un asistente de coaching especializado en empleabilidad y transición profesional.
Tu rol es ayudar a usuarios a:
- Entender sus fortalezas y brechas
- Desarrollar estrategias de búsqueda de empleo
- Prepararse para entrevistas
- Networking efectivo
- Análisis de mercado laboral

Responde en español, de forma empática y accionable.
Evita respuestas genéricas: personaliza según el contexto del usuario.
Cuando sea apropiado, pregunta para entender mejor la situación antes de dar consejos.`;

  if (!contexto) {
    return basePrompt;
  }

  const contextoParts = [];

  if (contexto.situacion) {
    contextoParts.push(`Situación actual: ${contexto.situacion}`);
  }
  if (contexto.objetivo) {
    contextoParts.push(`Objetivo: ${contexto.objetivo}`);
  }
  if (contexto.habilidades && contexto.habilidades.length > 0) {
    contextoParts.push(`Habilidades clave: ${contexto.habilidades.join(', ')}`);
  }
  if (contexto.experiencia) {
    contextoParts.push(`Experiencia: ${contexto.experiencia}`);
  }
  if (contexto.industria_actual) {
    contextoParts.push(`Industria actual: ${contexto.industria_actual}`);
  }
  if (contexto.industria_objetivo) {
    contextoParts.push(`Industria objetivo: ${contexto.industria_objetivo}`);
  }
  if (contexto.notas_adicionales) {
    contextoParts.push(`Notas: ${contexto.notas_adicionales}`);
  }

  if (contextoParts.length === 0) {
    return basePrompt;
  }

  return `${basePrompt}

CONTEXTO DEL USUARIO:
${contextoParts.join('\n')}

Usa este contexto para personalizar tus respuestas.`;
}

/**
 * Extrae un análisis de empleabilidad de un historial de conversación
 *
 * @param messages - Historial de mensajes
 * @param apiKey - API key de Gemini
 * @param contexto - Contexto inicial del usuario
 * @returns AnalysisResult con insights
 *
 * @example
 * const analysis = await extractAnalysis(
 *   historicalMessages,
 *   process.env.GEMINI_API_KEY!,
 *   userContext
 * );
 */
export async function extractAnalysis(
  messages: Message[],
  apiKey: string,
  contexto?: ContextoInicial,
): Promise<AnalysisResult> {
  if (!messages || messages.length === 0) {
    throw new GeminiError(
      'Se necesita historial de conversación para análisis',
      'EMPTY_MESSAGES',
      400,
    );
  }

  // Convertir mensajes a formato Gemini
  const geminiMessages: GeminiMessage[] = messages.map((msg) => ({
    role: msg.rol === 'user' ? 'user' : 'model',
    parts: [{ text: msg.contenido }],
  }));

  // Agregar prompt de análisis
  const analysisPrompt = `Basándote en esta conversación, proporciona un análisis estructurado de empleabilidad en formato JSON.

IMPORTANTE: Responde SOLO con un JSON válido, sin explicaciones adicionales.

El JSON debe tener esta estructura exacta:
{
  "fortalezas": ["fortaleza1", "fortaleza2", ...],
  "brechas": ["brecha1", "brecha2", ...],
  "recomendaciones": ["recomendacion1", "recomendacion2", ...],
  "proximos_pasos": ["paso1", "paso2", ...],
  "puntuacion_empleabilidad": 75,
  "resumen": "Resumen breve de hallazgos clave"
}

Asegúrate de:
- Mínimo 3 items en cada array (excepto resumen)
- Puntuación entre 0-100
- Recomendaciones accionables y específicas
- Próximos pasos concretos`;

  geminiMessages.push({
    role: 'user',
    parts: [{ text: analysisPrompt }],
  });

  try {
    const response = await callGemini(geminiMessages, apiKey, {
      temperature: 0.5, // Más determinístico para análisis
      maxTokens: 1500,
      timeout: 10000,
    });

    // Parsear respuesta JSON
    const jsonMatch = response.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new GeminiError(
        'Gemini no retornó análisis en formato JSON válido',
        'INVALID_JSON_RESPONSE',
        500,
      );
    }

    const analysisData = JSON.parse(jsonMatch[0]);

    // Validar estructura
    if (!Array.isArray(analysisData.fortalezas) ||
        !Array.isArray(analysisData.brechas) ||
        !Array.isArray(analysisData.recomendaciones) ||
        !Array.isArray(analysisData.proximos_pasos)) {
      throw new GeminiError(
        'Análisis no tiene estructura esperada',
        'INVALID_ANALYSIS_STRUCTURE',
        500,
      );
    }

    return {
      fortalezas: analysisData.fortalezas,
      brechas: analysisData.brechas,
      recomendaciones: analysisData.recomendaciones,
      proximos_pasos: analysisData.proximos_pasos,
      puntuacion_empleabilidad: analysisData.puntuacion_empleabilidad ?? undefined,
      resumen: analysisData.resumen ?? undefined,
    };
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Error desconocido';
    throw new GeminiError(
      `Error al extraer análisis: ${message}`,
      'ANALYSIS_EXTRACTION_ERROR',
      500,
    );
  }
}

/**
 * Calcula el tiempo estimado de procesamiento
 * basado en tokens y modelo
 *
 * @param tokens - Número de tokens
 * @param model - Modelo Gemini
 * @returns Tiempo estimado en ms
 */
export function estimateProcessingTime(tokens: number, model: string = 'gemini-pro'): number {
  // Estimaciones base (ms por token)
  const timePerToken = model === 'gemini-pro' ? 0.5 : 1;
  // Agregar latencia de red (200-500ms)
  const networkLatency = 350;

  return Math.ceil(tokens * timePerToken + networkLatency);
}

/**
 * Crea un objeto de configuración por defecto para Gemini
 *
 * @returns GeminiCallOptions con valores por defecto
 */
export function getDefaultGeminiConfig(): Required<GeminiCallOptions> {
  return {
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 5000,
    model: 'gemini-pro',
    topK: 40,
    topP: 0.95,
  };
}

/**
 * Sanitiza tokens de una respuesta Gemini
 * Remueve metadatos sensibles
 *
 * @param response - Respuesta de Gemini
 * @returns Respuesta sanitizada
 */
export function sanitizeGeminiResponse(response: GeminiResponse): GeminiResponse {
  return {
    ...response,
    response: response.response
      .replace(/\b(API|key|token|secret)\b/gi, '[REDACTED]')
      .trim(),
  };
}
