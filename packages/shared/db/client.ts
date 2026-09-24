/**
 * Cliente de Base de Datos - Supabase
 * Gestión de conexiones y operaciones CRUD
 *
 * Proyecto: Asistente de Empleabilidad
 * Version: 1.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DatabaseClient,
  UsuarioDB,
  ConversacionDB,
  MensajeDB,
  AnalisisDB,
  UsuarioCreate,
  UsuarioUpdate,
  ConversacionCreate,
  ConversacionUpdate,
  MensajeCreate,
  MensajeUpdate,
  AnalisisCreate,
  AnalisisUpdate,
  UsuarioRepository,
  ConversacionRepository,
  MensajeRepository,
  AnalisisRepository,
} from './index';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/**
 * Variables de entorno requeridas
 */
interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Obtiene configuración de Supabase desde variables de entorno
 */
function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'SUPABASE_URL y SUPABASE_ANON_KEY son requeridos en variables de entorno'
    );
  }

  return { url, anonKey };
}

// ============================================================================
// CLIENTE DE BASE DE DATOS
// ============================================================================

/**
 * Implementación de DatabaseClient usando Supabase
 */
export class SupabaseDatabaseClient implements DatabaseClient {
  private client: SupabaseClient;
  private connected: boolean = false;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Conecta a la base de datos y valida la conexión
   */
  async connect(): Promise<void> {
    try {
      // Intenta hacer una query simple para validar conexión
      const { error } = await this.client
        .from('usuarios')
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Error conectando a Supabase: ${error.message}`);
      }

      this.connected = true;
      console.log('✓ Conexión a Supabase establecida');
    } catch (error) {
      this.connected = false;
      console.error('✗ Error conectando a Supabase:', error);
      throw error;
    }
  }

  /**
   * Desconecta de la base de datos
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('✓ Desconectado de Supabase');
  }

  /**
   * Verifica si está conectado
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Retorna el cliente de Supabase para acceso directo si es necesario
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}

// ============================================================================
// REPOSITORIOS
// ============================================================================

/**
 * Repositorio para operaciones CRUD en tabla usuarios
 */
export class SupabaseUsuarioRepository implements UsuarioRepository {
  constructor(private client: SupabaseClient) {}

  async create(usuario: UsuarioCreate): Promise<UsuarioDB> {
    const { data, error } = await this.client
      .from('usuarios')
      .insert([usuario])
      .select()
      .single();

    if (error) throw new Error(`Error creando usuario: ${error.message}`);
    return data as UsuarioDB;
  }

  async findById(id: string): Promise<UsuarioDB | null> {
    const { data, error } = await this.client
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw new Error(`Error buscando usuario: ${error.message}`);
    return data as UsuarioDB;
  }

  async findByEmail(email: string): Promise<UsuarioDB | null> {
    const { data, error } = await this.client
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw new Error(`Error buscando usuario: ${error.message}`);
    return data as UsuarioDB;
  }

  async update(id: string, data: UsuarioUpdate): Promise<UsuarioDB> {
    const updateData = {
      ...data,
      actualizado_en: new Date().toISOString(),
    };

    const { data: result, error } = await this.client
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Error actualizando usuario: ${error.message}`);
    return result as UsuarioDB;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Error eliminando usuario: ${error.message}`);
    return true;
  }
}

/**
 * Repositorio para operaciones CRUD en tabla conversaciones
 */
export class SupabaseConversacionRepository implements ConversacionRepository {
  constructor(private client: SupabaseClient) {}

  async create(conversacion: ConversacionCreate): Promise<ConversacionDB> {
    const { data, error } = await this.client
      .from('conversaciones')
      .insert([conversacion])
      .select()
      .single();

    if (error) throw new Error(`Error creando conversación: ${error.message}`);
    return data as ConversacionDB;
  }

  async findById(id: string): Promise<ConversacionDB | null> {
    const { data, error } = await this.client
      .from('conversaciones')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw new Error(`Error buscando conversación: ${error.message}`);
    return data as ConversacionDB;
  }

  async findByUsuarioId(usuario_id: string): Promise<ConversacionDB[]> {
    const { data, error } = await this.client
      .from('conversaciones')
      .select('*')
      .eq('usuario_id', usuario_id)
      .order('creado_en', { ascending: false });

    if (error) throw new Error(`Error buscando conversaciones: ${error.message}`);
    return (data || []) as ConversacionDB[];
  }

  async update(id: string, data: ConversacionUpdate): Promise<ConversacionDB> {
    const updateData = {
      ...data,
      actualizado_en: new Date().toISOString(),
    };

    const { data: result, error } = await this.client
      .from('conversaciones')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Error actualizando conversación: ${error.message}`);
    return result as ConversacionDB;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('conversaciones')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Error eliminando conversación: ${error.message}`);
    return true;
  }
}

/**
 * Repositorio para operaciones CRUD en tabla mensajes
 */
export class SupabaseMensajeRepository implements MensajeRepository {
  constructor(private client: SupabaseClient) {}

  async create(mensaje: MensajeCreate): Promise<MensajeDB> {
    const { data, error } = await this.client
      .from('mensajes')
      .insert([mensaje])
      .select()
      .single();

    if (error) throw new Error(`Error creando mensaje: ${error.message}`);
    return data as MensajeDB;
  }

  async findById(id: string): Promise<MensajeDB | null> {
    const { data, error } = await this.client
      .from('mensajes')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw new Error(`Error buscando mensaje: ${error.message}`);
    return data as MensajeDB;
  }

  async findByConversacionId(conversacion_id: string): Promise<MensajeDB[]> {
    const { data, error } = await this.client
      .from('mensajes')
      .select('*')
      .eq('conversacion_id', conversacion_id)
      .order('creado_en', { ascending: true });

    if (error) throw new Error(`Error buscando mensajes: ${error.message}`);
    return (data || []) as MensajeDB[];
  }

  async update(id: string, data: MensajeUpdate): Promise<MensajeDB> {
    const { data: result, error } = await this.client
      .from('mensajes')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Error actualizando mensaje: ${error.message}`);
    return result as MensajeDB;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('mensajes')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Error eliminando mensaje: ${error.message}`);
    return true;
  }
}

/**
 * Repositorio para operaciones CRUD en tabla analisis
 */
export class SupabaseAnalisisRepository implements AnalisisRepository {
  constructor(private client: SupabaseClient) {}

  async create(analisis: AnalisisCreate): Promise<AnalisisDB> {
    const { data, error } = await this.client
      .from('analisis')
      .insert([analisis])
      .select()
      .single();

    if (error) throw new Error(`Error creando análisis: ${error.message}`);
    return data as AnalisisDB;
  }

  async findById(id: string): Promise<AnalisisDB | null> {
    const { data, error } = await this.client
      .from('analisis')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw new Error(`Error buscando análisis: ${error.message}`);
    return data as AnalisisDB;
  }

  async findByUsuarioId(usuario_id: string): Promise<AnalisisDB[]> {
    const { data, error } = await this.client
      .from('analisis')
      .select('*')
      .eq('usuario_id', usuario_id)
      .order('creado_en', { ascending: false });

    if (error) throw new Error(`Error buscando análisis: ${error.message}`);
    return (data || []) as AnalisisDB[];
  }

  async update(id: string, data: AnalisisUpdate): Promise<AnalisisDB> {
    const { data: result, error } = await this.client
      .from('analisis')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Error actualizando análisis: ${error.message}`);
    return result as AnalisisDB;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('analisis')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Error eliminando análisis: ${error.message}`);
    return true;
  }
}

// ============================================================================
// FACTORY Y EXPORTACIONES
// ============================================================================

/**
 * Instancia global del cliente (singleton)
 */
let databaseClientInstance: SupabaseDatabaseClient | null = null;

/**
 * Inicializa y retorna la instancia del cliente de base de datos
 */
export async function initSupabaseDatabase(): Promise<SupabaseDatabaseClient> {
  if (databaseClientInstance) {
    return databaseClientInstance;
  }

  const config = getSupabaseConfig();
  const supabaseClient = createClient(config.url, config.anonKey);
  databaseClientInstance = new SupabaseDatabaseClient(supabaseClient);

  await databaseClientInstance.connect();

  return databaseClientInstance;
}

/**
 * Retorna la instancia actual del cliente (requiere inicialización previa)
 */
export function getDatabaseClient(): SupabaseDatabaseClient {
  if (!databaseClientInstance) {
    throw new Error('Database client not initialized. Call initSupabaseDatabase() first.');
  }
  return databaseClientInstance;
}

/**
 * Factory para crear repositorios
 */
export interface RepositorieFactory {
  usuarios: UsuarioRepository;
  conversaciones: ConversacionRepository;
  mensajes: MensajeRepository;
  analisis: AnalisisRepository;
}

/**
 * Crea una instancia de repositorios para una sesión
 */
export function createRepositories(client: SupabaseClient): RepositorieFactory {
  return {
    usuarios: new SupabaseUsuarioRepository(client),
    conversaciones: new SupabaseConversacionRepository(client),
    mensajes: new SupabaseMensajeRepository(client),
    analisis: new SupabaseAnalisisRepository(client),
  };
}

/**
 * Retorna los repositorios de la instancia actual
 */
export function getRepositories(): RepositorieFactory {
  const dbClient = getDatabaseClient();
  return createRepositories(dbClient.getClient());
}
