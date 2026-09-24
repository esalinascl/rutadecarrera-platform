-- Asistente de Empleabilidad: Schema Inicial
-- Migración: 001_init_schema.sql
-- Descripción: Define tablas principales para usuarios, conversaciones, mensajes y análisis

-- ============================================================================
-- TABLA: usuarios
-- Almacena información de usuarios del asistente
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  profesion VARCHAR(255),
  objetivo_profesional TEXT,
  contexto_inicial JSONB,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- ============================================================================
-- TABLA: conversaciones
-- Almacena sesiones de chat entre usuario y asistente
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_id ON conversaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_creado_en ON conversaciones(creado_en);

-- ============================================================================
-- TABLA: mensajes
-- Almacena mensajes individuales dentro de cada conversación
-- ============================================================================
CREATE TABLE IF NOT EXISTS mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('user', 'assistant')),
  contenido TEXT NOT NULL,
  tokens_usage INTEGER,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_id ON mensajes(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_creado_en ON mensajes(creado_en);

-- ============================================================================
-- TABLA: analisis
-- Almacena resultados de análisis de empleabilidad
-- ============================================================================
CREATE TABLE IF NOT EXISTS analisis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50),
  resultado JSONB,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_analisis_usuario_id ON analisis(usuario_id);
CREATE INDEX IF NOT EXISTS idx_analisis_creado_en ON analisis(creado_en);

-- ============================================================================
-- COMENTARIOS DE SEGURIDAD Y PERFORMANCE
-- ============================================================================
-- 1. ON DELETE CASCADE: Eliminar un usuario elimina todos sus datos relacionados
-- 2. Índices en usuario_id para queries de lectura frecuentes
-- 3. Índices en creado_en para ordenamiento y paginación temporal
-- 4. JSONB para contexto_inicial y resultado permite flexible schema evolution
-- 5. CHECK constraint en rol garantiza valores válidos ('user' o 'assistant')
-- ============================================================================
