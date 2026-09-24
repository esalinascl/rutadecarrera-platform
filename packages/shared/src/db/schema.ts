/**
 * @file db/schema.ts
 * @description Schema de base de datos para Supabase PostgreSQL
 * Define las tablas principales de la aplicación
 */

/**
 * Tipo de base de datos Supabase
 * Placeholder para tipos generados por Supabase
 */
export type Database = {
  public: {
    Tables: {
      usuarios: UsuarioRow;
      conversaciones: ConversacionRow;
      mensajes: MensajeRow;
      analisis: AnalisisRow;
    };
  };
};

/**
 * Fila de tabla usuarios
 */
export interface UsuarioRow {
  id: string;
  email: string;
  nombre: string;
  contexto_inicial?: Record<string, unknown>;
  creado_en: Date;
  actualizado_en: Date;
}

/**
 * Fila de tabla conversaciones
 */
export interface ConversacionRow {
  id: string;
  usuario_id: string;
  titulo: string;
  activa: boolean;
  creado_en: Date;
  actualizado_en: Date;
}

/**
 * Fila de tabla mensajes
 */
export interface MensajeRow {
  id: string;
  conversacion_id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  tokens_used?: number;
  creado_en: Date;
}

/**
 * Fila de tabla análisis
 */
export interface AnalisisRow {
  id: string;
  usuario_id: string;
  tipo: 'empleabilidad' | 'potencial' | 'brecha-skills';
  resultado: Record<string, unknown>;
  creado_en: Date;
}

/**
 * SQL para crear esquema de base de datos
 * Debe ejecutarse en Supabase como migration
 */
export const SCHEMA_SQL = `
-- Tabla usuarios
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  contexto_inicial JSONB,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice en email para búsquedas rápidas
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- Tabla conversaciones
CREATE TABLE conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255),
  activa BOOLEAN DEFAULT true,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices en conversaciones
CREATE INDEX idx_conversaciones_usuario_id ON conversaciones(usuario_id);
CREATE INDEX idx_conversaciones_creado_en ON conversaciones(creado_en DESC);

-- Tabla mensajes
CREATE TABLE mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  rol VARCHAR(50) CHECK (rol IN ('user', 'assistant')) NOT NULL,
  contenido TEXT NOT NULL,
  tokens_used INTEGER,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices en mensajes
CREATE INDEX idx_mensajes_conversacion_id ON mensajes(conversacion_id);
CREATE INDEX idx_mensajes_creado_en ON mensajes(creado_en DESC);

-- Tabla análisis
CREATE TABLE analisis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) CHECK (tipo IN ('empleabilidad', 'potencial', 'brecha-skills')) NOT NULL,
  resultado JSONB NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices en análisis
CREATE INDEX idx_analisis_usuario_id ON analisis(usuario_id);
CREATE INDEX idx_analisis_tipo ON analisis(tipo);
CREATE INDEX idx_analisis_creado_en ON analisis(creado_en DESC);

-- Habilitar Row Level Security
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analisis ENABLE ROW LEVEL SECURITY;
`;
