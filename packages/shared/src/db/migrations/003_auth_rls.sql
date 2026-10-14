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
--   3. Crea la fila en `usuarios` al registrarse y mantiene su email al día
--      cuando cambia en `auth.users` (triggers).
--   4. Marca `actualizado_en` automáticamente al editar (trigger).
--   5. Recorta los privilegios abiertos que Supabase da por defecto, también
--      para las tablas que se creen en el futuro.
--   6. Crea las políticas RLS: cada usuario solo accede a lo suyo.
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
-- Repetible: se puede ejecutar más de una vez sin error ni duplicados, incluso
-- por un rol que no es dueño de `auth.users` (por eso el trigger sobre esa
-- tabla se crea solo si no existe, en vez de DROP + CREATE).
-- Atómica: va dentro de una transacción; si algo falla, no queda a medias.
-- Orden de despliegue: primero STAGING, verificar, y recién después PRODUCCIÓN.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Rol del usuario (AD-9 → A)
-- ----------------------------------------------------------------------------
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'cliente';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_rol_check' AND conrelid = 'public.usuarios'::regclass) THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_id_auth_fkey' AND conrelid = 'public.usuarios'::regclass) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_id_auth_fkey
      FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Alta automática en `usuarios` y email al día
-- ----------------------------------------------------------------------------
-- Las funciones son SECURITY DEFINER: corren con los privilegios de su dueño,
-- porque quien dispara el trigger (el servicio de Auth) no tiene ni debe tener
-- permiso sobre `usuarios`. Por eso fijan `search_path` (evita que alguien
-- "suplante" una tabla o función) y ninguna es invocable desde la API.

-- Alta: el rol SIEMPRE es "cliente" (se ignora cualquier "rol" de los metadatos,
-- que el propio usuario controla). Un registro sin email se rechaza con un
-- mensaje claro: hoy solo existe acceso por Magic Link, que siempre trae email.
-- Si se habilita otro método (teléfono, anónimo) hay que revisar `usuarios.email`.
CREATE OR REPLACE FUNCTION public.crear_usuario_al_registrarse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'No se puede registrar un usuario sin email: la plataforma solo admite acceso por Magic Link'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.usuarios (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    -- `nombre` es VARCHAR(255): se recorta para no romper el registro.
    left(
      COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'nombre'), ''), split_part(NEW.email, '@', 1)),
      255
    ),
    'cliente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Email al día: si cambia en `auth.users`, `usuarios.email` lo sigue. Sin esto
-- quedaría desactualizado y el email viejo, ya libre en Auth, haría fallar el
-- registro de otra persona por la restricción UNIQUE de `usuarios`.
CREATE OR REPLACE FUNCTION public.sincronizar_email_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.usuarios SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Nadie las invoca a mano ni desde la API: solo las ejecutan los triggers.
-- (`REVOKE ... FROM PUBLIC` no basta: Supabase da EXECUTE explícito a estos roles.)
REVOKE ALL ON FUNCTION public.crear_usuario_al_registrarse()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sincronizar_email_usuario()
  FROM PUBLIC, anon, authenticated, service_role;

-- Los triggers sobre `auth.users` se crean solo si no existen: `DROP TRIGGER`
-- exige ser dueño de la tabla, y quien migra (`postgres`) no lo es.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'al_registrarse_crear_usuario'
      AND tgrelid = 'auth.users'::regclass AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER al_registrarse_crear_usuario
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.crear_usuario_al_registrarse();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'al_cambiar_email_sincronizar_usuario'
      AND tgrelid = 'auth.users'::regclass AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER al_cambiar_email_sincronizar_usuario
      AFTER UPDATE OF email ON auth.users
      FOR EACH ROW
      WHEN (NEW.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email)
      EXECUTE FUNCTION public.sincronizar_email_usuario();
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 3b. `actualizado_en` lo marca la base
-- ----------------------------------------------------------------------------
-- El navegador no puede escribir esa columna (no tiene GRANT), así que no puede
-- falsearla; la base la actualiza sola en cada UPDATE.
CREATE OR REPLACE FUNCTION public.marcar_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_actualizado_en()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS antes_de_editar_marcar_fecha ON usuarios;
CREATE TRIGGER antes_de_editar_marcar_fecha
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION public.marcar_actualizado_en();

DROP TRIGGER IF EXISTS antes_de_editar_marcar_fecha ON conversaciones;
CREATE TRIGGER antes_de_editar_marcar_fecha
  BEFORE UPDATE ON conversaciones
  FOR EACH ROW EXECUTE FUNCTION public.marcar_actualizado_en();

-- ----------------------------------------------------------------------------
-- 4. Privilegios: cerrar lo que Supabase deja abierto por defecto
-- ----------------------------------------------------------------------------
-- Supabase otorga ALL sobre toda tabla nueva de "public" a anon, authenticated
-- y service_role. Se revoca para anon y authenticated y se otorga SOLO lo
-- necesario, por columna cuando corresponde. `anon` queda sin nada.
REVOKE ALL ON usuarios, conversaciones, mensajes, analisis FROM anon, authenticated;

-- Lo mismo para las tablas y secuencias que se creen EN EL FUTURO por quien
-- migra: nacen cerradas para anon y authenticated. Cada tabla nueva debe traer
-- su propio GRANT, su RLS y sus políticas (y su test). `service_role` conserva
-- los privilegios por defecto. No se tocan las funciones futuras a propósito:
-- quien cree una función para usarla desde la API debe decidir su EXECUTE.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

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

COMMIT;
