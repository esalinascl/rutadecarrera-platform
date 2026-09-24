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
import { analysisResultSchema } from './validation';

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

  // El timeout cubre la petición COMPLETA (encabezados + lectura del cuerpo),
  // no solo la llegada de encabezados: si no, un cuerpo lento colgaría la
  // respuesta y rompería el requisito de latencia de la SPEC.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // La API key va en el header, nunca en la URL (las URLs quedan en logs).
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

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
  } finally {
    clearTimeout(timeoutId);
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

  // Personaliza el análisis con el contexto inicial del usuario (RF-1 de la SPEC).
  // formatGeminiPrompt devuelve el prompt base si el contexto está vacío.
  const promptConContexto = contexto
    ? `${formatGeminiPrompt(contexto)}\n\n${analysisPrompt}`
    : analysisPrompt;

  geminiMessages.push({
    role: 'user',
    parts: [{ text: promptConContexto }],
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

    const analysisData: unknown = JSON.parse(jsonMatch[0]);

    // Una sola regla de validación para todo el sistema: analysisResultSchema.
    // (Antes aquí había una validación propia, más débil, que aceptaba listas
    // vacías o puntajes fuera de rango.)
    const validado = analysisResultSchema.safeParse(analysisData);
    if (!validado.success) {
      const detalle = validado.error.issues.map((i) => i.message).join('; ');
      throw new GeminiError(
        `Análisis no tiene estructura esperada: ${detalle}`,
        'INVALID_ANALYSIS_STRUCTURE',
        500,
      );
    }

    return validado.data;
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
    response: ocultarSecretos(response.response).trim(),
  };
}

/**
 * Patrones de VALORES con forma de secreto. Se ocultan los valores, no las
 * palabras: "API" o "token" son vocabulario normal en coaching de carrera
 * para perfiles técnicos y no deben censurarse.
 */
const PATRONES_DE_SECRETOS: ReadonlyArray<RegExp> = [
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{4,}/g, // Claves estilo OpenAI/Stripe
  /\bAIza[0-9A-Za-z_-]{20,}/g, // Claves de Google (incluida Gemini)
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g, // Tokens de GitHub
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT (ej. claves de Supabase)
];

/** Valor escrito a continuación de una etiqueta sensible: "token: abc1", "password=xyz9". */
const VALOR_ETIQUETADO =
  /\b(api[ _-]?key|token|secret|password|contraseña|clave)(\s*[:=]\s*)([^\s,;]+)/gi;

/**
 * Decide si el valor que sigue a una etiqueta tiene forma de secreto.
 *
 * En español "clave:" o "token:" aparecen en texto normal de coaching
 * ("Punto clave: constancia"). Un secreto real casi siempre contiene
 * dígitos o es una cadena larga sin espacios; una palabra común no.
 */
function pareceSecreto(valor: string): boolean {
  const limpio = valor.replace(/[.!?)]+$/, '');
  return /\d/.test(limpio) || limpio.length >= 16;
}

/**
 * Oculta secretos en un texto reemplazando sus valores por "[REDACTED]".
 *
 * @example
 * ocultarSecretos('Tu API key: sk-12345')       // 'Tu API key: [REDACTED]'
 * ocultarSecretos('Punto clave: constancia.')  // sin cambios
 * ocultarSecretos('Diseña una API REST')        // sin cambios
 */
export function ocultarSecretos(texto: string): string {
  const sinEtiquetados = texto.replace(
    VALOR_ETIQUETADO,
    (coincidencia, etiqueta: string, separador: string, valor: string) =>
      pareceSecreto(valor) ? `${etiqueta}${separador}[REDACTED]` : coincidencia,
  );
  return PATRONES_DE_SECRETOS.reduce(
    (acumulado, patron) => acumulado.replace(patron, '[REDACTED]'),
    sinEtiquetados,
  );
}
