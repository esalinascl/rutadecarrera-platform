/**
 * @file types/index.ts
 * @description Tipos compartidos para el Asistente de Empleabilidad
 *
 * Contiene definiciones de tipos e interfaces utilizadas en toda la plataforma:
 * - User: Información del usuario
 * - Conversation: Sesión de chat
 * - Message: Mensaje individual
 * - Analysis: Análisis de empleabilidad
 * - ChatRequest/ChatResponse: Interfaces de API
 * - GeminiMessage: Formato para Gemini API
 */

/**
 * Fecha en formato ISO 8601 con zona horaria (ej. "2026-09-24T10:30:00.000Z").
 *
 * Es lo que Supabase devuelve para columnas TIMESTAMPTZ y lo que viaja por JSON
 * en la API. No se usa `Date` porque no sobrevive la serialización.
 */
export type IsoDateString = string;

/**
 * Usuario registrado en la plataforma.
 * Refleja exactamente la tabla `usuarios` (ver db/migrations/001_init_schema.sql).
 *
 * @example
 * const user: User = {
 *   id: "uuid-123",
 *   email: "user@example.com",
 *   nombre: "Juan Pérez",
 *   contexto_inicial: { situacion: "Desempleado" },
 *   creado_en: "2026-09-24T10:30:00.000Z",
 *   actualizado_en: "2026-09-24T10:30:00.000Z"
 * }
 */
export interface User {
  id: string;
  email: string;
  nombre: string;
  contexto_inicial: ContextoInicial | null;
  creado_en: IsoDateString;
  actualizado_en: IsoDateString;
}

/**
 * Contexto inicial proporcionado por el usuario
 * Se utiliza para personalizar las respuestas de Gemini
 */
export interface ContextoInicial {
  situacion?: string;
  objetivo?: string;
  habilidades?: string[];
  experiencia?: string;
  industria_actual?: string;
  industria_objetivo?: string;
  notas_adicionales?: string;
}

/**
 * Conversación entre usuario y asistente.
 * Refleja exactamente la tabla `conversaciones`.
 *
 * @example
 * const conversation: Conversation = {
 *   id: "conv-456",
 *   usuario_id: "uuid-123",
 *   titulo: "Primera sesión de coaching",
 *   creado_en: "2026-09-24T10:30:00.000Z",
 *   actualizado_en: "2026-09-24T10:30:00.000Z"
 * }
 */
export interface Conversation {
  id: string;
  usuario_id: string;
  titulo: string | null;
  creado_en: IsoDateString;
  actualizado_en: IsoDateString;
}

/**
 * Mensaje individual en una conversación.
 * Refleja exactamente la tabla `mensajes`. El nombre `tokens_usage` viene del
 * modelo de datos de la SPEC.
 *
 * @example
 * const message: Message = {
 *   id: "msg-789",
 *   conversacion_id: "conv-456",
 *   rol: "user",
 *   contenido: "¿Cómo puedo mejorar mi CV?",
 *   tokens_usage: 45,
 *   creado_en: "2026-09-24T10:30:00.000Z"
 * }
 */
export interface Message {
  id: string;
  conversacion_id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  tokens_usage: number | null;
  creado_en: IsoDateString;
}

/**
 * Análisis de empleabilidad del usuario.
 * Refleja exactamente la tabla `analisis`. `tipo` es texto libre hasta que la
 * TASK 16 defina la lista cerrada de tipos (la SPEC no la restringe).
 *
 * @example
 * const analysis: Analysis = {
 *   id: "anl-101",
 *   usuario_id: "uuid-123",
 *   tipo: "empleabilidad",
 *   resultado: { fortalezas: [...], brechas: [...], recomendaciones: [...], proximos_pasos: [...] },
 *   creado_en: "2026-09-24T10:30:00.000Z"
 * }
 */
export interface Analysis {
  id: string;
  usuario_id: string;
  tipo: string | null;
  resultado: AnalysisResult | null;
  creado_en: IsoDateString;
}

/**
 * Resultado de análisis con insights detallados
 */
export interface AnalysisResult {
  fortalezas: string[];
  brechas: string[];
  recomendaciones: string[];
  proximos_pasos: string[];
  puntuacion_empleabilidad?: number;
  resumen?: string;
}

/**
 * Request para enviar un mensaje al chat
 *
 * @example
 * const chatRequest: ChatRequest = {
 *   usuario_id: "uuid-123",
 *   conversacion_id: "conv-456",
 *   mensaje: "¿Qué roles se alinean con mi perfil?",
 *   contexto: { situacion: "Desempleado" }
 * }
 */
export interface ChatRequest {
  usuario_id: string;
  conversacion_id?: string;
  mensaje: string;
  contexto?: ContextoInicial;
  historial?: GeminiMessage[];
}

/**
 * Response del endpoint de chat
 * Contiene la respuesta del asistente y metadata
 *
 * @example
 * const chatResponse: ChatResponse = {
 *   respuesta: "Basado en tu perfil...",
 *   tokens_used: 250,
 *   id_mensaje: "msg-789",
 *   conversacion_id: "conv-456"
 * }
 */
export interface ChatResponse {
  respuesta: string;
  tokens_used: number;
  id_mensaje: string;
  conversacion_id: string;
  timestamp: IsoDateString;
}

/**
 * Formato de mensaje para Gemini API
 * Sigue el estándar de Gemini Pro
 *
 * @example
 * const geminiMsg: GeminiMessage = {
 *   role: "user",
 *   parts: [{ text: "Hola, soy Juan" }]
 * }
 */
export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{
    text: string;
  }>;
}

/**
 * Request para análisis de empleabilidad
 */
export interface AnalysisRequest {
  usuario_id: string;
  conversacion_id: string;
  tipo: 'empleabilidad' | 'potencial' | 'brecha-skills';
  historial?: Message[];
}

/**
 * Request para análisis con contexto completo
 */
export interface AnalysisContextRequest extends AnalysisRequest {
  contexto?: ContextoInicial;
}

/**
 * Opciones para llamadas a Gemini
 */
export interface GeminiCallOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  model?: string;
  topK?: number;
  topP?: number;
}

/**
 * Respuesta de Gemini API
 */
export interface GeminiResponse {
  response: string;
  tokensUsed: number;
  model: string;
  finishReason?: string;
}

/**
 * Error estructurado de validación
 */
export interface ValidationError {
  campo: string;
  mensaje: string;
  tipo: string;
}

/**
 * Respuesta de validación
 */
export interface ValidationResult {
  valido: boolean;
  errores?: ValidationError[];
}

/**
 * Metadata de API response
 */
export interface ApiResponseMeta {
  timestamp: IsoDateString;
  version: string;
  requestId: string;
}

/**
 * Respuesta estándar de API
 */
export interface ApiResponse<T> {
  datos?: T;
  error?: string;
  meta: ApiResponseMeta;
}

/**
 * Configuración del sistema para Gemini
 */
export interface GeminiSystemConfig {
  modelo: string;
  temperatura: number;
  maxTokens: number;
  timeout: number;
  knowledgeBase: string;
}

/**
 * Cache entry para respuestas
 */
export interface CacheEntry<T> {
  clave: string;
  valor: T;
  expira_en: IsoDateString;
  creado_en: IsoDateString;
}

/**
 * Estadísticas de uso de la API
 */
export interface UsageStats {
  usuario_id: string;
  total_mensajes: number;
  total_tokens: number;
  promedio_tokens_por_mensaje: number;
  total_conversaciones: number;
  periodo: {
    inicio: IsoDateString;
    fin: IsoDateString;
  };
}

// ============================================================================
// MÓDULO DE CRÉDITOS (BORRADOR — no aplicado a producción todavía)
// ============================================================================
// Fuente funcional: vault, "600 PROYECTOS/650 F&S RUTA DE CARRERA/
// SPEC — Paquetes y Créditos de Tests (Interno).md" v0.4 (sección 5, Modelo
// de datos). Migración SQL propuesta (también borrador):
// packages/shared/src/db/migrations/002_creditos.sql
//
// Deliberadamente NO se integran todavía a `COLUMNAS_POR_TABLA` (db/schema.ts)
// ni a ningún repositorio: eso requiere que la re-planificación de TASKS
// resuelva primero AD-3 (login) y AD-9/AD-10 (permisos/RLS) — ver
// 600 PROYECTOS/TAREAS/Re-planificar TASKS para una sola app y módulo de
// créditos.md. Lo que sí se puede fijar ya (no depende de auth): la forma de
// calcular un saldo a partir del libro de movimientos — ver
// `calcularSaldoCredito` en utils/creditos.ts, con tests.
// ============================================================================

/** Código estable de un producto con saldo propio (SPEC §2). */
export type CodigoProducto = 'disc' | 'rueda_fundadora' | 'asistente';

/** Un test (créditos enteros) o el asistente (medido en milésimas de Crédito IA). */
export type TipoProducto = 'test' | 'asistente';

/** Unidad base en la que se mide el saldo de un producto. */
export type UnidadProducto = 'credito' | 'milesima_credito_ia';

export interface Producto {
  id: string;
  codigo: CodigoProducto;
  tipo: TipoProducto;
  unidad: UnidadProducto;
  nombre: string;
  activo: boolean;
}

/** Lo que se vende: N unidades de un producto, con precio (SPEC §2). */
export interface Paquete {
  id: string;
  producto_id: string;
  nombre: string;
  /** Cantidad en la unidad base del producto (créditos enteros, o milésimas de Crédito IA). */
  cantidad: number;
  precio: number;
  moneda: string;
  activo: boolean;
}

export type EstadoCompra = 'pendiente' | 'pagada' | 'fallida' | 'reembolsada';

export interface Compra {
  id: string;
  usuario_id: string;
  paquete_id: string;
  monto: number;
  moneda: string;
  proveedor_pago: string | null;
  /** Id único que entrega la pasarela de pago (NF-4 de la SPEC: evita doble abono). */
  referencia_externa: string | null;
  estado: EstadoCompra;
  creado_en: IsoDateString;
  pagada_en: IsoDateString | null;
}

/**
 * Tipo de movimiento del libro de créditos (NF-1 de la SPEC: el saldo nunca
 * se guarda directo, se calcula sumando estos movimientos).
 *
 * Convención de signos — decisión de implementación de esta migración
 * borrador, la SPEC original solo dice "delta" sin fijar la convención:
 * `magnitud` es SIEMPRE >= 0, salvo en `'ajuste_admin'` donde el admin puede
 * sumar o restar directamente. La dirección del efecto (qué bucket sube o
 * baja) la determina el `tipo`, no el signo de `magnitud` — ver la tabla de
 * reglas en `calcularSaldoCredito` (utils/creditos.ts). Se eligió así (en
 * vez de un delta con signo libre) para que sea imposible invertir el efecto
 * de un movimiento por un error de signo al insertarlo.
 */
export type TipoMovimientoCredito =
  | 'compra'
  | 'reserva'
  | 'liberacion'
  | 'consumo'
  | 'consumo_tokens'
  | 'ajuste_admin'
  | 'reembolso';

export interface MovimientoCredito {
  id: string;
  usuario_id: string;
  producto_id: string;
  tipo: TipoMovimientoCredito;
  /** Cantidad en la unidad base del producto. Ver TipoMovimientoCredito. */
  magnitud: number;
  compra_id: string | null;
  invitacion_id: string | null;
  mensaje_id: string | null;
  autor_id: string | null;
  motivo: string | null;
  creado_en: IsoDateString;
}

/** Saldo derivado del libro de movimientos para un (usuario, producto). */
export interface SaldoCredito {
  disponibles: number;
  reservados: number;
  usados: number;
}

export type EstadoInvitacion =
  | 'enviada'
  | 'abierta'
  | 'en_curso'
  | 'completada'
  | 'expirada'
  | 'revocada';

export type CanalInvitacion = 'email' | 'link';

export interface InvitacionTest {
  id: string;
  emisor_id: string;
  producto_id: string;
  email_destino: string;
  nombre_destino: string | null;
  cliente_id: string | null;
  /** Solo se guarda el hash del token (NF-3 de la SPEC); el token real vive en el link. */
  token_hash: string;
  canal: CanalInvitacion;
  estado: EstadoInvitacion;
  consentimiento_en: IsoDateString | null;
  clave_idempotencia: string | null;
  expira_en: IsoDateString;
  creado_en: IsoDateString;
  abierta_en: IsoDateString | null;
  completada_en: IsoDateString | null;
  /** FK pendiente: `test_disc_resultados` todavía no existe (ver M5 del PLAN). */
  resultado_id: string | null;
}

/** Conversión configurable de tokens de Gemini a Créditos IA (NF-11 de la SPEC). */
export interface TarifaCreditoIA {
  id: string;
  tokens_por_credito: number;
  peso_entrada: number;
  peso_salida: number;
  vigente_desde: IsoDateString;
  creado_por: string | null;
}
