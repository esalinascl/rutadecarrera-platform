-- ============================================================================
-- Asistente de Empleabilidad — Migración 003: autenticación, roles y RLS
-- ============================================================================
-- TASK 8. Decisiones: AD-9 → A (solo roles) y AD-10 → B1 ("cada dueño ve lo
-- suyo"; el consultor viendo a sus clientes es B2 y queda para después).
-- Los tests que definen este comportamiento están en
-- `src/__tests__/rls.test.ts` y se escribieron ANTES que este archivo.
--
-- Qué hace:
--   1. Agrega `usuarios.rol` (cliente | consultor | admin), por defecto "cliente".
--   2. Enlaza `usuarios.id` con `auth.users(id)` (sin usuarios "fantasma").
--   3. Crea la fila en `usuarios` automáticamente al registrarse (trigger).
--   4. Recorta los privilegios abiertos que Supabase da por defecto.
--   5. Crea las políticas RLS: cada usuario solo accede a lo suyo.
--
-- Defensa en dos capas:
--   - RLS decide QUÉ FILAS ve/toca cada usuario.
--   - GRANT por columna decide QUÉ COLUMNAS puede escribir (así nadie puede
--     cambiar su `rol`, su `email` ni el dueño de una conversación).
--
-- `service_role` ignora RLS y conserva todos sus privilegios (operaciones de
-- sistema: créditos, pagos, administración).
--
-- No cambia datos: las 4 tablas están vacías en staging y producción.
-- Repetible: se puede ejecutar más de una vez sin error ni duplicados.
-- Orden de despliegue: primero STAGING, verificar, y recién después PRODUCCIÓN.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rol del usuario (AD-9 → A)
-- ----------------------------------------------------------------------------
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'cliente';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_rol_check') THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('cliente', 'consultor', 'admin'));
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. `usuarios.id` pertenece a un usuario real de Supabase Auth
-- ----------------------------------------------------------------------------
-- ON DELETE CASCADE: si se elimina la cuenta, se elimina su fila y, por las
-- llaves de la migración 001, también sus conversaciones, mensajes y análisis.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_id_auth_fkey') THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_id_auth_fkey
      FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Alta automática en `usuarios` al registrarse
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: corre con los privilegios de su dueño, porque quien se
-- registra todavía no tiene (ni debe tener) permiso de INSERT en `usuarios`.
-- Por eso fija `search_path` (evita que alguien "suplante" una tabla o función).
-- El rol SIEMPRE es "cliente": se ignora cualquier "rol" que venga en los
-- metadatos del registro, que el propio usuario controla.
CREATE OR REPLACE FUNCTION public.crear_usuario_al_registrarse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'nombre'), ''), split_part(NEW.email, '@', 1)),
    'cliente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Nadie puede invocar la función a mano; solo la ejecuta el trigger.
REVOKE ALL ON FUNCTION public.crear_usuario_al_registrarse() FROM PUBLIC;

DROP TRIGGER IF EXISTS al_registrarse_crear_usuario ON auth.users;
CREATE TRIGGER al_registrarse_crear_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.crear_usuario_al_registrarse();

-- ----------------------------------------------------------------------------
-- 4. Privilegios: cerrar lo que Supabase deja abierto por defecto
-- ----------------------------------------------------------------------------
-- Supabase otorga ALL sobre toda tabla nueva de "public" a anon, authenticated
-- y service_role. Se revoca para anon y authenticated y se otorga SOLO lo
-- necesario, por columna cuando corresponde. `anon` queda sin nada.
REVOKE ALL ON usuarios, conversaciones, mensajes, analisis FROM anon, authenticated;

GRANT SELECT ON usuarios, conversaciones, mensajes, analisis TO authenticated;

-- usuarios: solo puede editar su nombre y su contexto. NO `rol`, `email`, `id`.
GRANT UPDATE (nombre, contexto_inicial) ON usuarios TO authenticated;

-- conversaciones: crear (con su dueño) y renombrar. NO puede cambiar `usuario_id`.
GRANT INSERT (usuario_id, titulo) ON conversaciones TO authenticated;
GRANT UPDATE (titulo) ON conversaciones TO authenticated;

-- mensajes: escribir mensajes. NO `tokens_usage` (campo de consumo: solo el sistema).
GRANT INSERT (conversacion_id, rol, contenido) ON mensajes TO authenticated;

-- analisis: crear análisis propios.
GRANT INSERT (usuario_id, tipo, resultado) ON analisis TO authenticated;

-- Nadie borra desde el navegador (no se otorga DELETE). Se agregará cuando una
-- TASK lo necesite, con su propia política y su propio test.

-- ----------------------------------------------------------------------------
-- 5. Políticas RLS: "cada dueño ve lo suyo" (AD-10 → B1)
-- ----------------------------------------------------------------------------
-- Todas aplican solo al rol `authenticated`. Para `anon` no hay política ni
-- privilegio: no ve ni escribe nada. `(SELECT auth.uid())` se evalúa una sola
-- vez por consulta en vez de una por fila (recomendación de Supabase).

-- usuarios ------------------------------------------------------------------
DROP POLICY IF EXISTS usuarios_ver_propio ON usuarios;
CREATE POLICY usuarios_ver_propio ON usuarios
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS usuarios_editar_propio ON usuarios;
CREATE POLICY usuarios_editar_propio ON usuarios
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- conversaciones ------------------------------------------------------------
DROP POLICY IF EXISTS conversaciones_ver_propias ON conversaciones;
CREATE POLICY conversaciones_ver_propias ON conversaciones
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS conversaciones_crear_propias ON conversaciones;
CREATE POLICY conversaciones_crear_propias ON conversaciones
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS conversaciones_editar_propias ON conversaciones;
CREATE POLICY conversaciones_editar_propias ON conversaciones
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()))
  WITH CHECK (usuario_id = (SELECT auth.uid()));

-- mensajes (el dueño es el de la conversación) --------------------------------
DROP POLICY IF EXISTS mensajes_ver_propios ON mensajes;
CREATE POLICY mensajes_ver_propios ON mensajes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversaciones c
      WHERE c.id = mensajes.conversacion_id
        AND c.usuario_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS mensajes_crear_propios ON mensajes;
CREATE POLICY mensajes_crear_propios ON mensajes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversaciones c
      WHERE c.id = mensajes.conversacion_id
        AND c.usuario_id = (SELECT auth.uid())
    )
  );

-- analisis ------------------------------------------------------------------
DROP POLICY IF EXISTS analisis_ver_propios ON analisis;
CREATE POLICY analisis_ver_propios ON analisis
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS analisis_crear_propios ON analisis;
CREATE POLICY analisis_crear_propios ON analisis
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));
