-- ============================================================================
-- Reversa de la migración 004 (códigos DISC por miembro)
-- ============================================================================
-- Solo si hay que volver atrás. BORRA los códigos asignados: antes de correrla
-- en producción, exportar la tabla (y pedir el OK de Eduardo).
-- No toca nada de la 001 ni de la 003. Repetible y atómica.
-- Probada en `src/__tests__/codigos-disc.test.ts` (PGlite) y, antes del OK de
-- producción, en staging.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS codigos_disc_ver_propio ON codigos_disc;
DROP TABLE IF EXISTS codigos_disc;

COMMIT;
