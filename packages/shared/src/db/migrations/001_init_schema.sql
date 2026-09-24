-- ============================================================================
-- Asistente de Empleabilidad — Migración 001: esquema inicial
-- ============================================================================
-- FUENTE ÚNICA DE VERDAD del esquema. Las entidades de `src/types/index.ts`
-- deben reflejar estas columnas; el test `db-schema.test.ts` lo verifica.
--
-- Modelo de datos según SPEC-Asistente-Empleabilidad (sección MODELO DE DATOS).
-- Datos del formulario de contexto (situación, objetivo, profesión, etc.)
-- viven en `usuarios.contexto_inicial` (JSONB), no como columnas.
--
-- Repetible: usa IF NOT EXISTS, se puede ejecutar más de una vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- usuarios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) UNIQUE NOT NULL,
  nombre           VARCHAR(255) NOT NULL,
  contexto_inicial JSONB,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- conversaciones
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversaciones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo         VARCHAR(255),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_id ON conversaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_creado_en  ON conversaciones(creado_en DESC);

-- ----------------------------------------------------------------------------
-- mensajes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensajes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  rol             VARCHAR(20) NOT NULL CHECK (rol IN ('user', 'assistant')),
  contenido       TEXT NOT NULL,
  tokens_usage    INTEGER CHECK (tokens_usage IS NULL OR tokens_usage >= 0),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_id ON mensajes(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_creado_en       ON mensajes(creado_en);

-- ----------------------------------------------------------------------------
-- analisis
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analisis (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo       VARCHAR(50),
  resultado  JSONB,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analisis_usuario_id ON analisis(usuario_id);
CREATE INDEX IF NOT EXISTS idx_analisis_creado_en  ON analisis(creado_en DESC);

-- ============================================================================
-- SEGURIDAD: Row Level Security activado, SIN políticas todavía.
-- ----------------------------------------------------------------------------
-- Efecto: la clave pública (anon) no puede leer ni escribir nada.
-- Solo el backend con la service role key (que ignora RLS) accede a los datos.
-- Las políticas por usuario se agregan en la migración de autenticación
-- (TASK 9) ANTES de exponer cualquier acceso desde el navegador.
-- ============================================================================
ALTER TABLE usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE analisis       ENABLE ROW LEVEL SECURITY;
