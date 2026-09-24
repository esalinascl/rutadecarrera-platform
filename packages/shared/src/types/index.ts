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

import type { Database } from '../db/schema';

/**
 * Usuario registrado en la plataforma
 *
 * @example
 * const user: User = {
 *   id: "uuid-123",
 *   email: "user@example.com",
 *   nombre: "Juan Pérez",
 *   contexto_inicial: { situacion: "Desempleado" }
 * }
 */
export interface User {
  id: string;
  email: string;
  nombre: string;
  contexto_inicial?: ContextoInicial;
  creado_en: Date;
  actualizado_en: Date;
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
 * Conversación entre usuario y asistente
 *
 * @example
 * const conversation: Conversation = {
 *   id: "conv-456",
 *   usuario_id: "uuid-123",
 *   titulo: "Primera sesión de coaching",
 *   activa: true
 * }
 */
export interface Conversation {
  id: string;
  usuario_id: string;
  titulo: string;
  activa: boolean;
  creado_en: Date;
  actualizado_en: Date;
}

/**
 * Mensaje individual en una conversación
 *
 * @example
 * const message: Message = {
 *   id: "msg-789",
 *   conversacion_id: "conv-456",
 *   rol: "user",
 *   contenido: "¿Cómo puedo mejorar mi CV?",
 *   tokens_used: 45
 * }
 */
export interface Message {
  id: string;
  conversacion_id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  tokens_used?: number;
  creado_en: Date;
}

/**
 * Análisis de empleabilidad del usuario
 * Contiene evaluación de fortalezas, brechas y recomendaciones
 *
 * @example
 * const analysis: Analysis = {
 *   id: "anl-101",
 *   usuario_id: "uuid-123",
 *   tipo: "empleabilidad",
 *   resultado: { fortalezas: [...] }
 * }
 */
export interface Analysis {
  id: string;
  usuario_id: string;
  tipo: 'empleabilidad' | 'potencial' | 'brecha-skills';
  resultado: AnalysisResult;
  creado_en: Date;
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
  timestamp: Date;
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
  timestamp: Date;
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
  expira_en: Date;
  creado_en: Date;
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
    inicio: Date;
    fin: Date;
  };
}
