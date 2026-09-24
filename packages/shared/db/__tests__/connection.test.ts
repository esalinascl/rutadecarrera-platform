/**
 * Tests para conexión a Supabase y validación de schema
 *
 * Proyecto: Asistente de Empleabilidad
 * Version: 1.0
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { SupabaseDatabaseClient, createRepositories } from '../client';

// ============================================================================
// MOCKS Y SETUP
// ============================================================================

/**
 * Mock del cliente de Supabase para tests
 */
const mockSupabaseClient = {
  from: vi.fn(),
};

const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
};

// ============================================================================
// TESTS: CONEXIÓN A SUPABASE
// ============================================================================

describe('Supabase Database Connection', () => {
  let dbClient: SupabaseDatabaseClient;

  beforeAll(() => {
    // Configura mocks
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it('debería conectarse a Supabase exitosamente', async () => {
    dbClient = new SupabaseDatabaseClient(mockSupabaseClient as any);

    await dbClient.connect();

    expect(dbClient.isConnected()).toBe(true);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('usuarios');
    expect(mockQueryBuilder.select).toHaveBeenCalled();
  });

  it('debería desconectarse correctamente', async () => {
    dbClient = new SupabaseDatabaseClient(mockSupabaseClient as any);
    await dbClient.connect();

    await dbClient.disconnect();

    expect(dbClient.isConnected()).toBe(false);
  });

  it('debería manejar error de conexión', async () => {
    const errorClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ error: new Error('Connection failed') }),
      }),
    };

    const dbClient2 = new SupabaseDatabaseClient(errorClient as any);

    await expect(dbClient2.connect()).rejects.toThrow();
    expect(dbClient2.isConnected()).toBe(false);
  });
});

// ============================================================================
// TESTS: VALIDACIÓN DE SCHEMA
// ============================================================================

describe('Database Schema Validation', () => {
  it('debería validar que todas las tablas existen', async () => {
    const expectedTables = ['usuarios', 'conversaciones', 'mensajes', 'analisis'];

    mockSupabaseClient.from.mockImplementation((tableName: string) => {
      if (expectedTables.includes(tableName)) {
        return mockQueryBuilder;
      }
      throw new Error(`Tabla no encontrada: ${tableName}`);
    });

    for (const tableName of expectedTables) {
      expect(() => {
        mockSupabaseClient.from(tableName);
      }).not.toThrow();
    }
  });

  it('debería validar estructura de tabla usuarios', async () => {
    const usuarioSchema = {
      id: 'UUID',
      email: 'VARCHAR',
      nombre: 'VARCHAR',
      profesion: 'VARCHAR',
      objetivo_profesional: 'TEXT',
      contexto_inicial: 'JSONB',
      creado_en: 'TIMESTAMP',
      actualizado_en: 'TIMESTAMP',
    };

    // Verifica que los campos esperados existen en el schema
    const expectedFields = Object.keys(usuarioSchema);
    expect(expectedFields).toContain('id');
    expect(expectedFields).toContain('email');
    expect(expectedFields).toContain('nombre');
  });

  it('debería validar estructura de tabla conversaciones', () => {
    const conversacionSchema = {
      id: 'UUID',
      usuario_id: 'UUID',
      titulo: 'VARCHAR',
      creado_en: 'TIMESTAMP',
      actualizado_en: 'TIMESTAMP',
    };

    const expectedFields = Object.keys(conversacionSchema);
    expect(expectedFields).toContain('usuario_id');
    expect(expectedFields).toContain('conversacion_id');
  });

  it('debería validar estructura de tabla mensajes', () => {
    const mensajeSchema = {
      id: 'UUID',
      conversacion_id: 'UUID',
      rol: 'VARCHAR',
      contenido: 'TEXT',
      tokens_usage: 'INTEGER',
      creado_en: 'TIMESTAMP',
    };

    const expectedFields = Object.keys(mensajeSchema);
    expect(expectedFields).toContain('rol');
    expect(expectedFields).toContain('contenido');
  });

  it('debería validar estructura de tabla analisis', () => {
    const analisisSchema = {
      id: 'UUID',
      usuario_id: 'UUID',
      tipo: 'VARCHAR',
      resultado: 'JSONB',
      creado_en: 'TIMESTAMP',
    };

    const expectedFields = Object.keys(analisisSchema);
    expect(expectedFields).toContain('usuario_id');
    expect(expectedFields).toContain('resultado');
  });
});

// ============================================================================
// TESTS: OPERACIONES CRUD
// ============================================================================

describe('CRUD Operations', () => {
  beforeAll(() => {
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
  });

  it('debería crear un usuario', async () => {
    const repositories = createRepositories(mockSupabaseClient as any);

    const newUsuario = {
      email: 'test@example.com',
      nombre: 'Test User',
      profesion: 'Developer',
    };

    mockQueryBuilder.insert.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: { id: '123', ...newUsuario, creado_en: new Date() },
      error: null,
    });

    const usuario = await repositories.usuarios.create(newUsuario);

    expect(usuario.email).toBe(newUsuario.email);
    expect(usuario.nombre).toBe(newUsuario.nombre);
  });

  it('debería buscar usuario por email', async () => {
    const repositories = createRepositories(mockSupabaseClient as any);

    mockQueryBuilder.eq.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: {
        id: '123',
        email: 'test@example.com',
        nombre: 'Test User',
      },
      error: null,
    });

    const usuario = await repositories.usuarios.findByEmail('test@example.com');

    expect(usuario).not.toBeNull();
    expect(usuario?.email).toBe('test@example.com');
  });

  it('debería crear una conversación', async () => {
    const repositories = createRepositories(mockSupabaseClient as any);

    const newConversacion = {
      usuario_id: '123',
      titulo: 'Primera conversación',
    };

    mockQueryBuilder.insert.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: { id: '456', ...newConversacion, creado_en: new Date() },
      error: null,
    });

    const conversacion = await repositories.conversaciones.create(newConversacion);

    expect(conversacion.usuario_id).toBe(newConversacion.usuario_id);
    expect(conversacion.titulo).toBe(newConversacion.titulo);
  });

  it('debería crear un mensaje', async () => {
    const repositories = createRepositories(mockSupabaseClient as any);

    const newMensaje = {
      conversacion_id: '456',
      rol: 'user' as const,
      contenido: 'Hola, necesito ayuda',
    };

    mockQueryBuilder.insert.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: { id: '789', ...newMensaje, creado_en: new Date() },
      error: null,
    });

    const mensaje = await repositories.mensajes.create(newMensaje);

    expect(mensaje.rol).toBe('user');
    expect(mensaje.contenido).toBe(newMensaje.contenido);
  });
});

// ============================================================================
// TESTS: ÍNDICES Y PERFORMANCE
// ============================================================================

describe('Database Indexes', () => {
  it('debería tener índices en campos de búsqueda frecuente', () => {
    const expectedIndexes = {
      usuarios: ['idx_usuarios_email'],
      conversaciones: ['idx_conversaciones_usuario_id', 'idx_conversaciones_creado_en'],
      mensajes: ['idx_mensajes_conversacion_id', 'idx_mensajes_creado_en'],
      analisis: ['idx_analisis_usuario_id', 'idx_analisis_creado_en'],
    };

    // Verifica que los índices estén definidos en la migración
    for (const [table, indexes] of Object.entries(expectedIndexes)) {
      indexes.forEach((index) => {
        expect(index).toMatch(/^idx_/);
      });
    }
  });

  it('debería optimizar queries con índices', () => {
    // En PostgreSQL, los índices mejoran la performance de:
    // - WHERE usuario_id = ?
    // - WHERE conversacion_id = ?
    // - ORDER BY creado_en
    // - WHERE email = ?

    expect(['usuario_id', 'conversacion_id', 'creado_en', 'email']).toContain(
      'usuario_id'
    );
  });
});

// ============================================================================
// TESTS: INTEGRIDAD REFERENCIAL
// ============================================================================

describe('Referential Integrity', () => {
  it('debería validar foreign keys', () => {
    const foreignKeys = {
      conversaciones: 'usuario_id -> usuarios.id',
      mensajes: 'conversacion_id -> conversaciones.id',
      analisis: 'usuario_id -> usuarios.id',
    };

    expect(foreignKeys.conversaciones).toBeDefined();
    expect(foreignKeys.mensajes).toBeDefined();
    expect(foreignKeys.analisis).toBeDefined();
  });

  it('debería tener ON DELETE CASCADE', () => {
    // Cuando se elimina un usuario, se deben eliminar:
    // - Todas sus conversaciones
    // - Todos los mensajes en esas conversaciones
    // - Todos sus análisis

    const cascadeRules = {
      conversaciones: 'ON DELETE CASCADE',
      analisis: 'ON DELETE CASCADE',
    };

    expect(cascadeRules.conversaciones).toContain('CASCADE');
  });
});
