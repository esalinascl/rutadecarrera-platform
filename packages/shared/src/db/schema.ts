/**
 * @file db/schema.ts
 * @description Contratos de la capa de datos (Supabase PostgreSQL).
 *
 * FUENTE ÚNICA DE VERDAD DEL ESQUEMA: `migrations/001_init_schema.sql`.
 * Las entidades (User, Conversation, Message, Analysis) están en `types/index.ts`
 * y reflejan esas tablas columna por columna. `COLUMNAS_POR_TABLA` es el puente
 * que el test `db-schema.test.ts` compara contra el SQL: si alguien agrega,
 * quita o renombra una columna en un solo lado, el test falla.
 */

import type { Analysis, Conversation, Message, User } from '../types';

// ============================================================================
// COLUMNAS POR TABLA (verificadas contra el SQL en los tests)
// ============================================================================

/**
 * Garantiza en tiempo de compilación que la lista contiene TODAS las claves
 * de la entidad, sin faltantes ni sobrantes.
 */
type ColumnasExactas<T> = readonly (keyof T)[] & {
  readonly length: number;
};

function columnas<T>() {
  return <const K extends readonly (keyof T)[]>(
    lista: K & ([keyof T] extends [K[number]] ? unknown : never)
  ): ColumnasExactas<T> => lista;
}

/** Columnas de cada tabla, en el mismo orden que la migración SQL. */
export const COLUMNAS_POR_TABLA = {
  usuarios: columnas<User>()([
    'id',
    'email',
    'nombre',
    'contexto_inicial',
    'creado_en',
    'actualizado_en',
  ]),
  conversaciones: columnas<Conversation>()([
    'id',
    'usuario_id',
    'titulo',
    'creado_en',
    'actualizado_en',
  ]),
  mensajes: columnas<Message>()([
    'id',
    'conversacion_id',
    'rol',
    'contenido',
    'tokens_usage',
    'creado_en',
  ]),
  analisis: columnas<Analysis>()(['id', 'usuario_id', 'tipo', 'resultado', 'creado_en']),
} as const;

export type NombreTabla = keyof typeof COLUMNAS_POR_TABLA;

// ============================================================================
// TIPOS DE CREACIÓN Y ACTUALIZACIÓN
// ============================================================================

/** Campos que la base genera sola (no se envían al crear). */
type Generados = 'id' | 'creado_en' | 'actualizado_en';

export type UsuarioCreate = Omit<User, Generados>;
export type UsuarioUpdate = Partial<Omit<User, Generados>>;

export type ConversacionCreate = Omit<Conversation, Generados>;
export type ConversacionUpdate = Partial<Omit<Conversation, Generados | 'usuario_id'>>;

export type MensajeCreate = Omit<Message, 'id' | 'creado_en'>;

export type AnalisisCreate = Omit<Analysis, 'id' | 'creado_en'>;

// ============================================================================
// CONTRATOS DE REPOSITORIOS
// ============================================================================

/** Cliente de base de datos con ciclo de vida explícito. */
export interface DatabaseClient {
  /** Verifica la conexión. Lanza `DatabaseError` si falla. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface UsuarioRepository {
  create(usuario: UsuarioCreate): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: UsuarioUpdate): Promise<User>;
  delete(id: string): Promise<void>;
}

export interface ConversacionRepository {
  create(conversacion: ConversacionCreate): Promise<Conversation>;
  findById(id: string): Promise<Conversation | null>;
  findByUsuarioId(usuarioId: string): Promise<Conversation[]>;
  update(id: string, data: ConversacionUpdate): Promise<Conversation>;
  delete(id: string): Promise<void>;
}

/** Los mensajes son inmutables una vez guardados (historial de chat). */
export interface MensajeRepository {
  create(mensaje: MensajeCreate): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  findByConversacionId(conversacionId: string): Promise<Message[]>;
}

/** Los análisis son inmutables: uno nuevo reemplaza al anterior en la UI. */
export interface AnalisisRepository {
  create(analisis: AnalisisCreate): Promise<Analysis>;
  findById(id: string): Promise<Analysis | null>;
  findByUsuarioId(usuarioId: string): Promise<Analysis[]>;
}
