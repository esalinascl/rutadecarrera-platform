-- ============================================================================
-- Ruta de Carrera — Migración 004: códigos DISC por miembro de la Red
-- ============================================================================
-- SPEC «Web de la Red y área de miembros» v1.0 (R5.4, R7.1, R7.2; P2 = tabla
-- propia). Los tests que definen este comportamiento están en
-- `src/__tests__/codigos-disc.test.ts` y se escribieron ANTES que este archivo.
--
-- Qué hace:
--   1. Crea `codigos_disc`: a lo más un código por usuario, y un código no se
--      repite entre dos usuarios. Si se borra la cuenta, se borra su código.
--   2. Cierra los privilegios: `anon` no ve nada; `authenticated` solo puede
--      LEER; crear, cambiar y borrar códigos es solo de `service_role` (el
--      script de alta de miembros).
--   3. RLS: cada usuario lee solo su propia fila.
--
-- No cambia datos. Repetible y atómica (va dentro de una transacción).
-- Orden de despliegue: primero STAGING, verificar, y recién después PRODUCCIÓN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS codigos_disc (
  usuario_id  UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo      VARCHAR(64) NOT NULL UNIQUE CHECK (btrim(codigo) <> ''),
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE codigos_disc ENABLE ROW LEVEL SECURITY;

-- Privilegios: lo que Supabase abre por defecto se cierra aquí de forma
-- explícita (además de los privilegios por defecto que recortó la 003).
REVOKE ALL ON codigos_disc FROM anon, authenticated;
GRANT SELECT ON codigos_disc TO authenticated;

DROP POLICY IF EXISTS codigos_disc_ver_propio ON codigos_disc;
CREATE POLICY codigos_disc_ver_propio ON codigos_disc
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

COMMIT;
