/**
 * @file utils/validation.ts
 * @description Schemas de validación Zod para tipos compartidos
 *
 * Proporciona schemas para validar datos en request/response
 * y funciones helper para parsear y validar datos
 */

import { z } from 'zod';
import type {
  AnalysisRequest,
  AnalysisResult,
  ChatRequest,
  ChatResponse,
  ContextoInicial,
  Message,
  User,
  ValidationError,
} from '../types';
import type { UsuarioCreate } from '../db/schema';

/**
 * Esquema Zod atado a un tipo TypeScript.
 *
 * Todos los esquemas de este archivo usan `satisfies Esquema<Tipo>`: si el
 * esquema y el tipo divergen (un campo renombrado, una fecha `Date` vs texto),
 * TypeScript no compila. Evita una tercera copia desalineada del modelo.
 */
type Esquema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

/** Fecha ISO 8601 con zona horaria, como la devuelven Supabase y la API. */
const fechaIso = z.string().datetime({ offset: true, message: 'Fecha debe estar en formato ISO 8601' });

/**
 * Schema para contexto inicial del usuario
 */
export const contextoSchema = z.object({
  situacion: z.string().optional(),
  objetivo: z.string().optional(),
  habilidades: z.array(z.string()).optional(),
  experiencia: z.string().optional(),
  industria_actual: z.string().optional(),
  industria_objetivo: z.string().optional(),
  notas_adicionales: z.string().optional(),
}).strict() satisfies Esquema<ContextoInicial>;

/**
 * Schema para validar usuario (refleja la tabla `usuarios`)
 *
 * @example
 * const usuario = userSchema.parse(filaDeSupabase);
 */
export const userSchema = z.object({
  id: z.string().uuid('ID debe ser un UUID válido'),
  email: z.string().email('Email inválido'),
  nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  contexto_inicial: contextoSchema.nullable(),
  creado_en: fechaIso,
  actualizado_en: fechaIso,
}).strict() satisfies Esquema<User>;

/**
 * Schema para crear usuario (sin id ni fechas, que genera la base).
 * `contexto_inicial` es opcional al crear; si no viene, se guarda como null.
 */
export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  contexto_inicial: contextoSchema.nullable().default(null),
}).strict() satisfies Esquema<UsuarioCreate>;

/**
 * Schema para mensaje (refleja la tabla `mensajes`)
 */
export const messageSchema = z.object({
  id: z.string().uuid('ID debe ser un UUID válido'),
  conversacion_id: z.string().uuid('ID de conversación debe ser un UUID válido'),
  rol: z.enum(['user', 'assistant']),
  contenido: z.string().min(1, 'Contenido no puede estar vacío'),
  tokens_usage: z.number().int().nonnegative('Tokens no puede ser negativo').nullable(),
  creado_en: fechaIso,
}).strict() satisfies Esquema<Message>;

/**
 * Schema para request de chat
 *
 * @example
 * const request = {
 *   usuario_id: "uuid-123",
 *   mensaje: "Hola"
 * };
 * const validado = chatRequestSchema.parse(request);
 */
export const chatRequestSchema = z.object({
  usuario_id: z.string().uuid('ID de usuario debe ser un UUID válido'),
  conversacion_id: z.string().uuid('ID de conversación debe ser un UUID válido').optional(),
  mensaje: z.string()
    .min(1, 'Mensaje no puede estar vacío')
    .max(5000, 'Mensaje no puede exceder 5000 caracteres'),
  contexto: contextoSchema.optional(),
  historial: z.array(z.object({
    role: z.enum(['user', 'model']),
    parts: z.array(z.object({
      text: z.string(),
    })),
  })).optional(),
}).strict() satisfies Esquema<ChatRequest>;

/**
 * Schema para response de chat.
 * `tokens_used` es el nombre del contrato de API definido en el PLAN
 * (en la base de datos la columna se llama `tokens_usage`).
 */
export const chatResponseSchema = z.object({
  respuesta: z.string(),
  tokens_used: z.number().int().nonnegative('Tokens no puede ser negativo'),
  id_mensaje: z.string().uuid('ID debe ser un UUID válido'),
  conversacion_id: z.string().uuid('ID de conversación debe ser un UUID válido'),
  timestamp: fechaIso,
}).strict() satisfies Esquema<ChatResponse>;

/**
 * Schema para request de análisis
 */
export const analysisRequestSchema = z.object({
  usuario_id: z.string().uuid('ID de usuario debe ser un UUID válido'),
  conversacion_id: z.string().uuid('ID de conversación debe ser un UUID válido'),
  tipo: z.enum(['empleabilidad', 'potencial', 'brecha-skills']),
  historial: z.array(messageSchema).optional(),
  contexto: contextoSchema.optional(),
}).strict() satisfies Esquema<AnalysisRequest>;

/**
 * Schema para resultado de análisis
 */
export const analysisResultSchema = z.object({
  fortalezas: z.array(z.string()).min(1, 'Debe tener al menos una fortaleza'),
  brechas: z.array(z.string()).min(1, 'Debe tener al menos una brecha'),
  recomendaciones: z.array(z.string()).min(1, 'Debe tener al menos una recomendación'),
  proximos_pasos: z.array(z.string()).min(1, 'Debe tener al menos un próximo paso'),
  puntuacion_empleabilidad: z.number().min(0).max(100).optional(),
  resumen: z.string().optional(),
  // Sin .strict(): valida salida de un modelo de IA, que a veces agrega campos
  // no pedidos. Esos campos se descartan en vez de rechazar todo el análisis.
}) satisfies Esquema<AnalysisResult>;

/**
 * Valida un usuario
 *
 * @param datos - Datos a validar
 * @returns Usuario validado o throw ZodError
 *
 * @example
 * try {
 *   const usuario = validateUser({ email: "test@example.com", ... });
 * } catch (error) {
 *   console.error(error);
 * }
 */
export function validateUser(datos: unknown): z.infer<typeof userSchema> {
  return userSchema.parse(datos);
}

/**
 * Valida un request de chat
 *
 * @param datos - Datos a validar
 * @returns ChatRequest validado o throw ZodError
 */
export function validateChatRequest(datos: unknown): z.infer<typeof chatRequestSchema> {
  return chatRequestSchema.parse(datos);
}

/**
 * Valida una response de chat
 *
 * @param datos - Datos a validar
 * @returns ChatResponse validado o throw ZodError
 */
export function validateChatResponse(datos: unknown): z.infer<typeof chatResponseSchema> {
  return chatResponseSchema.parse(datos);
}

/**
 * Valida un request de análisis
 *
 * @param datos - Datos a validar
 * @returns AnalysisRequest validado o throw ZodError
 */
export function validateAnalysisRequest(datos: unknown): z.infer<typeof analysisRequestSchema> {
  return analysisRequestSchema.parse(datos);
}

/**
 * Intenta validar datos de forma segura (no tira error)
 *
 * @param datos - Datos a validar
 * @param schema - Schema Zod
 * @returns { valido: true, datos } o { valido: false, error }
 *
 * @example
 * const result = safeValidate(datos, userSchema);
 * if (result.valido) {
 *   console.log(result.datos);
 * } else {
 *   console.error(result.error);
 * }
 */
export function safeValidate<T>(
  datos: unknown,
  schema: z.ZodSchema<T>,
): { valido: true; datos: T } | { valido: false; error: ValidationError[] } {
  const resultado = schema.safeParse(datos);

  if (resultado.success) {
    return { valido: true, datos: resultado.data };
  }

  const errores: ValidationError[] = resultado.error.errors.map((err) => ({
    campo: err.path.join('.'),
    mensaje: err.message,
    tipo: err.code,
  }));

  return { valido: false, error: errores };
}

/**
 * Convierte errores Zod a formato amigable para el usuario
 *
 * @param error - Error de Zod
 * @returns Array de errores estructurados
 *
 * @example
 * try {
 *   userSchema.parse(datos);
 * } catch (error) {
 *   const erroresAmigables = parseZodError(error);
 *   res.status(400).json({ errores: erroresAmigables });
 * }
 */
export function parseZodError(error: unknown): ValidationError[] {
  if (!(error instanceof z.ZodError)) {
    return [
      {
        campo: 'general',
        mensaje: 'Error de validación desconocido',
        tipo: 'unknown',
      },
    ];
  }

  return error.errors.map((err) => ({
    campo: err.path.join('.') || 'raíz',
    mensaje: err.message,
    tipo: err.code,
  }));
}

/**
 * Crea un mensaje de error legible a partir de errores Zod
 *
 * @param error - Error de Zod
 * @returns String con mensaje de error amigable
 *
 * @example
 * try {
 *   userSchema.parse(datos);
 * } catch (error) {
 *   const mensaje = formatZodError(error);
 *   console.error(mensaje);
 * }
 */
export function formatZodError(error: unknown): string {
  if (!(error instanceof z.ZodError)) {
    return 'Error de validación desconocido';
  }

  const errores = error.errors
    .map((err) => `${err.path.join('.')}: ${err.message}`)
    .join('\n');

  return errores || 'Error de validación desconocido';
}

/**
 * Valida múltiples campos en paralelo
 * Útil para validaciones complejas
 *
 * @example
 * const results = await Promise.all([
 *   safeValidate(user, userSchema),
 *   safeValidate(mensaje, messageSchema),
 * ]);
 */
export async function validateMany(
  // Acepta esquemas de tipos distintos en una misma llamada (usuario + mensaje,
  // etc.); por eso el resultado es `unknown` y cada llamador lo acota.
  items: Array<{ datos: unknown; schema: z.ZodTypeAny }>,
): Promise<Array<{ valido: boolean; datos?: unknown; error?: ValidationError[] }>> {
  return Promise.all(
    items.map(({ datos, schema }) => safeValidate(datos, schema)),
  );
}
