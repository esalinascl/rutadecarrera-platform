/**
 * Módulo de Base de Datos
 * Gestión centralizada de conexiones, esquemas e interfaces de BD
 *
 * Proyecto: Asistente de Empleabilidad
 * Versión: 1.0
 */

import { User, Assessment, CareerPath } from '@rcp/types';

// ============================================================================
// TIPOS PARA ASISTENTE DE EMPLEABILIDAD
// ============================================================================

/**
 * Usuario del asistente de empleabilidad
 * Almacena datos de perfil y contexto inicial
 */
export interface UsuarioDB {
  id: string;
  email: string;
  nombre: string;
  profesion?: string;
  objetivo_profesional?: string;
  contexto_inicial?: Record<string, any>;
  creado_en: Date;
  actualizado_en: Date;
}

/**
 * Conversación entre usuario y asistente
 */
export interface ConversacionDB {
  id: string;
  usuario_id: string;
  titulo?: string;
  creado_en: Date;
  actualizado_en: Date;
}

/**
 * Mensaje individual en una conversación
 */
export interface MensajeDB {
  id: string;
  conversacion_id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  tokens_usage?: number;
  creado_en: Date;
}

/**
 * Análisis de empleabilidad generado por el sistema
 */
export interface AnalisisDB {
  id: string;
  usuario_id: string;
  tipo?: string;
  resultado?: Record<string, any>;
  creado_en: Date;
}

// ============================================================================
// TIPOS PARA CREACIÓN Y ACTUALIZACIÓN
// ============================================================================

export type UsuarioCreate = Omit<UsuarioDB, 'id' | 'creado_en' | 'actualizado_en'>;
export type UsuarioUpdate = Partial<Omit<UsuarioDB, 'id' | 'creado_en'>>;

export type ConversacionCreate = Omit<ConversacionDB, 'id' | 'creado_en' | 'actualizado_en'>;
export type ConversacionUpdate = Partial<Omit<ConversacionDB, 'id' | 'usuario_id' | 'creado_en'>>;

export type MensajeCreate = Omit<MensajeDB, 'id' | 'creado_en'>;
export type MensajeUpdate = Partial<Omit<MensajeDB, 'id' | 'conversacion_id' | 'creado_en'>>;

export type AnalisisCreate = Omit<AnalisisDB, 'id' | 'creado_en'>;
export type AnalisisUpdate = Partial<Omit<AnalisisDB, 'id' | 'usuario_id' | 'creado_en'>>;

// ============================================================================
// INTERFACES DE REPOSITORIOS
// ============================================================================

/**
 * Interfaz para el cliente de base de datos
 */
export interface DatabaseClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Interfaz para operaciones CRUD de Usuario
 */
export interface UsuarioRepository {
  create(usuario: UsuarioCreate): Promise<UsuarioDB>;
  findById(id: string): Promise<UsuarioDB | null>;
  findByEmail(email: string): Promise<UsuarioDB | null>;
  update(id: string, data: UsuarioUpdate): Promise<UsuarioDB>;
  delete(id: string): Promise<boolean>;
}

/**
 * Interfaz para operaciones CRUD de Conversación
 */
export interface ConversacionRepository {
  create(conversacion: ConversacionCreate): Promise<ConversacionDB>;
  findById(id: string): Promise<ConversacionDB | null>;
  findByUsuarioId(usuario_id: string): Promise<ConversacionDB[]>;
  update(id: string, data: ConversacionUpdate): Promise<ConversacionDB>;
  delete(id: string): Promise<boolean>;
}

/**
 * Interfaz para operaciones CRUD de Mensaje
 */
export interface MensajeRepository {
  create(mensaje: MensajeCreate): Promise<MensajeDB>;
  findById(id: string): Promise<MensajeDB | null>;
  findByConversacionId(conversacion_id: string): Promise<MensajeDB[]>;
  update(id: string, data: MensajeUpdate): Promise<MensajeDB>;
  delete(id: string): Promise<boolean>;
}

/**
 * Interfaz para operaciones CRUD de Análisis
 */
export interface AnalisisRepository {
  create(analisis: AnalisisCreate): Promise<AnalisisDB>;
  findById(id: string): Promise<AnalisisDB | null>;
  findByUsuarioId(usuario_id: string): Promise<AnalisisDB[]>;
  update(id: string, data: AnalisisUpdate): Promise<AnalisisDB>;
  delete(id: string): Promise<boolean>;
}

// ============================================================================
// ESQUEMA DE BASE DE DATOS (Referencia)
// ============================================================================

export const DATABASE_SCHEMA = {
  usuarios: {
    tableName: 'usuarios',
    columns: [
      'id',
      'email',
      'nombre',
      'profesion',
      'objetivo_profesional',
      'contexto_inicial',
      'creado_en',
      'actualizado_en',
    ],
    primaryKey: 'id',
    uniqueKeys: ['email'],
  },
  conversaciones: {
    tableName: 'conversaciones',
    columns: ['id', 'usuario_id', 'titulo', 'creado_en', 'actualizado_en'],
    primaryKey: 'id',
    foreignKeys: { usuario_id: 'usuarios.id' },
  },
  mensajes: {
    tableName: 'mensajes',
    columns: ['id', 'conversacion_id', 'rol', 'contenido', 'tokens_usage', 'creado_en'],
    primaryKey: 'id',
    foreignKeys: { conversacion_id: 'conversaciones.id' },
  },
  analisis: {
    tableName: 'analisis',
    columns: ['id', 'usuario_id', 'tipo', 'resultado', 'creado_en'],
    primaryKey: 'id',
    foreignKeys: { usuario_id: 'usuarios.id' },
  },
} as const;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

/**
 * Inicializa la conexión a la base de datos
 * Se implementará con Supabase (PostgreSQL)
 */
export async function initializeDatabase(): Promise<DatabaseClient> {
  // TODO: Implementar conexión a Supabase en packages/shared/db/client.ts
  throw new Error('Database not configured yet');
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

export type { User, Assessment, CareerPath };
export type {
  UsuarioRepository,
  ConversacionRepository,
  MensajeRepository,
  AnalisisRepository,
};
