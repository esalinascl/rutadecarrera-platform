/**
 * @file db/client.ts
 * @description Cliente Supabase de SERVIDOR y repositorios.
 *
 * SEGURIDAD:
 * - Usa `SUPABASE_SERVICE_ROLE_KEY`, que ignora Row Level Security.
 *   Por eso este módulo SOLO puede ejecutarse en el servidor (API routes,
 *   server actions). Si se importa en el navegador, lanza un error.
 * - Nunca exponer esta clave con prefijo `NEXT_PUBLIC_`.
 * - La clave pública (anon) no sirve aquí: con RLS activo y sin políticas,
 *   no puede leer ni escribir nada (ver migrations/001_init_schema.sql).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Analysis, Conversation, Message, User } from '../types';
import type {
  AnalisisCreate,
  AnalisisRepository,
  ConversacionCreate,
  ConversacionRepository,
  ConversacionUpdate,
  DatabaseClient,
  MensajeCreate,
  MensajeRepository,
  UsuarioCreate,
  UsuarioRepository,
  UsuarioUpdate,
} from './schema';

// ============================================================================
// ERRORES
// ============================================================================

/** Error de la capa de datos, con la operación que falló para diagnóstico. */
export class DatabaseError extends Error {
  constructor(
    public readonly operacion: string,
    mensaje: string,
    public readonly codigo?: string
  ) {
    super(`Error en base de datos (${operacion}): ${mensaje}`);
    this.name = 'DatabaseError';
  }
}

/** Forma mínima del error que devuelve Supabase. */
interface SupabaseErrorLike {
  message: string;
  code?: string;
}

function fallar(operacion: string, error: SupabaseErrorLike): never {
  throw new DatabaseError(operacion, error.message, error.code);
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/** Variables de entorno requeridas por el cliente de servidor. */
export interface SupabaseServerConfig {
  url: string;
  serviceRoleKey: string;
}

/**
 * Lee la configuración desde variables de entorno.
 * @throws Error si falta alguna variable o si se ejecuta en el navegador.
 */
export function leerConfigSupabase(
  env: Record<string, string | undefined> = process.env
): SupabaseServerConfig {
  if (typeof window !== 'undefined') {
    throw new Error(
      'El cliente de base de datos solo puede usarse en el servidor: usa la service role key.'
    );
  }

  const url = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias.'
    );
  }

  return { url, serviceRoleKey };
}

/** Crea el cliente Supabase de servidor (sin persistir sesión). */
export function crearClienteSupabase(config: SupabaseServerConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ============================================================================
// CLIENTE CON CICLO DE VIDA
// ============================================================================

export class SupabaseDatabaseClient implements DatabaseClient {
  private conectado = false;

  constructor(private readonly client: SupabaseClient) {}

  /** Verifica la conexión con una consulta mínima. */
  async connect(): Promise<void> {
    const { error } = await this.client.from('usuarios').select('id').limit(1);
    if (error) {
      this.conectado = false;
      fallar('connect', error);
    }
    this.conectado = true;
  }

  async disconnect(): Promise<void> {
    this.conectado = false;
  }

  isConnected(): boolean {
    return this.conectado;
  }
}

// ============================================================================
// REPOSITORIOS
// ============================================================================

export class SupabaseUsuarioRepository implements UsuarioRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(usuario: UsuarioCreate): Promise<User> {
    const { data, error } = await this.client.from('usuarios').insert(usuario).select().single();
    if (error) fallar('usuarios.create', error);
    return data as User;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) fallar('usuarios.findById', error);
    return (data as User | null) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) fallar('usuarios.findByEmail', error);
    return (data as User | null) ?? null;
  }

  async update(id: string, cambios: UsuarioUpdate): Promise<User> {
    const { data, error } = await this.client
      .from('usuarios')
      .update({ ...cambios, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) fallar('usuarios.update', error);
    return data as User;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('usuarios').delete().eq('id', id);
    if (error) fallar('usuarios.delete', error);
  }
}

export class SupabaseConversacionRepository implements ConversacionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(conversacion: ConversacionCreate): Promise<Conversation> {
    const { data, error } = await this.client
      .from('conversaciones')
      .insert(conversacion)
      .select()
      .single();
    if (error) fallar('conversaciones.create', error);
    return data as Conversation;
  }

  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from('conversaciones')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) fallar('conversaciones.findById', error);
    return (data as Conversation | null) ?? null;
  }

  async findByUsuarioId(usuarioId: string): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from('conversaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false });
    if (error) fallar('conversaciones.findByUsuarioId', error);
    return (data as Conversation[] | null) ?? [];
  }

  async update(id: string, cambios: ConversacionUpdate): Promise<Conversation> {
    const { data, error } = await this.client
      .from('conversaciones')
      .update({ ...cambios, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) fallar('conversaciones.update', error);
    return data as Conversation;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('conversaciones').delete().eq('id', id);
    if (error) fallar('conversaciones.delete', error);
  }
}

export class SupabaseMensajeRepository implements MensajeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(mensaje: MensajeCreate): Promise<Message> {
    const { data, error } = await this.client.from('mensajes').insert(mensaje).select().single();
    if (error) fallar('mensajes.create', error);
    return data as Message;
  }

  async findById(id: string): Promise<Message | null> {
    const { data, error } = await this.client
      .from('mensajes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) fallar('mensajes.findById', error);
    return (data as Message | null) ?? null;
  }

  /** Devuelve el historial en orden cronológico (el orden que necesita Gemini). */
  async findByConversacionId(conversacionId: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from('mensajes')
      .select('*')
      .eq('conversacion_id', conversacionId)
      .order('creado_en', { ascending: true });
    if (error) fallar('mensajes.findByConversacionId', error);
    return (data as Message[] | null) ?? [];
  }
}

export class SupabaseAnalisisRepository implements AnalisisRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(analisis: AnalisisCreate): Promise<Analysis> {
    const { data, error } = await this.client.from('analisis').insert(analisis).select().single();
    if (error) fallar('analisis.create', error);
    return data as Analysis;
  }

  async findById(id: string): Promise<Analysis | null> {
    const { data, error } = await this.client
      .from('analisis')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) fallar('analisis.findById', error);
    return (data as Analysis | null) ?? null;
  }

  async findByUsuarioId(usuarioId: string): Promise<Analysis[]> {
    const { data, error } = await this.client
      .from('analisis')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false });
    if (error) fallar('analisis.findByUsuarioId', error);
    return (data as Analysis[] | null) ?? [];
  }
}

// ============================================================================
// FÁBRICA
// ============================================================================

export interface Repositorios {
  usuarios: UsuarioRepository;
  conversaciones: ConversacionRepository;
  mensajes: MensajeRepository;
  analisis: AnalisisRepository;
}

/** Crea todos los repositorios sobre un mismo cliente. */
export function crearRepositorios(client: SupabaseClient): Repositorios {
  return {
    usuarios: new SupabaseUsuarioRepository(client),
    conversaciones: new SupabaseConversacionRepository(client),
    mensajes: new SupabaseMensajeRepository(client),
    analisis: new SupabaseAnalisisRepository(client),
  };
}
