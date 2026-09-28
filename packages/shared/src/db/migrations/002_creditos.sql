-- ============================================================================
-- Asistente de Empleabilidad — Migración 002: módulo de créditos (BORRADOR)
-- ============================================================================
-- ⚠️ BORRADOR — NO aplicada a ningún proyecto Supabase todavía (ni staging
-- ni producción). No está integrada a `packages/shared/src/db/schema.ts`
-- (COLUMNAS_POR_TABLA) ni a `types/index.ts` como columnas de `mensajes`, a
-- propósito: el test `db-schema.test.ts` compara SOLO contra
-- `001_init_schema.sql`, así que este archivo puede evolucionar sin romper
-- el CI mientras se termina de decidir.
--
-- Fuente funcional: vault, "600 PROYECTOS/650 F&S RUTA DE CARRERA/
-- SPEC — Paquetes y Créditos de Tests (Interno).md" v0.4 (sección 5).
-- Bloqueada por: 600 PROYECTOS/TAREAS/Re-planificar TASKS para una sola app
-- y módulo de créditos.md (AD-3 login, AD-9/AD-10 permisos y RLS).
--
-- La VISTA `saldos_credito` que menciona la SPEC NO se define aquí como SQL:
-- la convención de signos del libro de movimientos se fijó y se probó
-- primero en TypeScript (`calcularSaldoCredito`, utils/creditos.ts, con
-- tests en __tests__/creditos.test.ts) para no escribir una agregación SQL
-- sin tests. Cuando se decida llevarla a una vista de Postgres, debe
-- traducir exactamente esa misma tabla de reglas.
--
-- Orden de las tablas: se eligió para que cada FK se declare en su CREATE
-- TABLE (sin ALTER TABLE ADD CONSTRAINT después) — Postgres no soporta
-- "ADD CONSTRAINT IF NOT EXISTS", así que `movimientos_credito` (que
-- referencia a casi todas las demás) va al final.
--
-- Repetible: usa IF NOT EXISTS, se puede ejecutar más de una vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- productos — catálogo de cosas con saldo propio (antes "tests")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  VARCHAR(50) UNIQUE NOT NULL,
  tipo    VARCHAR(20) NOT NULL CHECK (tipo IN ('test', 'asistente')),
  unidad  VARCHAR(30) NOT NULL CHECK (unidad IN ('credito', 'milesima_credito_ia')),
  nombre  VARCHAR(255) NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT true
);

-- ----------------------------------------------------------------------------
-- paquetes — lo que se vende: N unidades de un producto, con precio
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paquetes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  nombre      VARCHAR(255) NOT NULL,
  -- Cantidad en la unidad base del producto (créditos enteros, o milésimas
  -- de Crédito IA). Sin columna de vigencia: los saldos no vencen (D-C5).
  cantidad    BIGINT NOT NULL CHECK (cantidad > 0),
  precio      NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
  moneda      VARCHAR(3) NOT NULL DEFAULT 'CLP',
  activo      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_paquetes_producto_id ON paquetes(producto_id);

-- ----------------------------------------------------------------------------
-- compras
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  paquete_id          UUID NOT NULL REFERENCES paquetes(id) ON DELETE RESTRICT,
  monto               NUMERIC(12, 2) NOT NULL CHECK (monto >= 0),
  moneda              VARCHAR(3) NOT NULL DEFAULT 'CLP',
  proveedor_pago      VARCHAR(50),
  -- Único: si la pasarela notifica el mismo pago dos veces, el segundo
  -- INSERT/UPDATE con la misma referencia no puede duplicar el abono (NF-4).
  referencia_externa  VARCHAR(255) UNIQUE,
  estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'pagada', 'fallida', 'reembolsada')),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  pagada_en           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_compras_usuario_id ON compras(usuario_id);
CREATE INDEX IF NOT EXISTS idx_compras_estado     ON compras(estado);

-- ----------------------------------------------------------------------------
-- invitaciones_test — envío de un test a una persona, respaldado por 1 crédito
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitaciones_test (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emisor_id           UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto_id         UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  email_destino       VARCHAR(255) NOT NULL,
  nombre_destino      VARCHAR(255),
  cliente_id          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  -- Solo se guarda el hash del token (NF-3): si se filtra la BD, los links
  -- siguen sin poder usarse.
  token_hash          VARCHAR(255) UNIQUE NOT NULL,
  canal               VARCHAR(10) NOT NULL CHECK (canal IN ('email', 'link')),
  estado              VARCHAR(20) NOT NULL DEFAULT 'enviada' CHECK (estado IN (
                        'enviada', 'abierta', 'en_curso', 'completada', 'expirada', 'revocada'
                      )),
  consentimiento_en   TIMESTAMPTZ,
  -- Evita crear 2 invitaciones si el consultor hace doble clic (RF-C3).
  clave_idempotencia  VARCHAR(255) UNIQUE,
  expira_en           TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'), -- P4
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  abierta_en          TIMESTAMPTZ,
  completada_en       TIMESTAMPTZ,
  -- Sin FK: `test_disc_resultados` todavía no existe (DISC dentro de la app
  -- es M5 del PLAN, la última etapa de la migración). Se agrega ahí.
  resultado_id        UUID
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_emisor_id  ON invitaciones_test(emisor_id);
CREATE INDEX IF NOT EXISTS idx_invitaciones_cliente_id ON invitaciones_test(cliente_id);
CREATE INDEX IF NOT EXISTS idx_invitaciones_estado     ON invitaciones_test(estado);

-- ----------------------------------------------------------------------------
-- tarifas_credito_ia — conversión configurable tokens → Créditos IA (NF-11)
-- ----------------------------------------------------------------------------
-- Se guarda con vigencia: cambiar la tarifa mañana no altera consumos
-- pasados, cada mensaje guarda la tarifa que usó (ver mensajes.tarifa_id).
CREATE TABLE IF NOT EXISTS tarifas_credito_ia (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tokens_por_credito  NUMERIC(12, 4) NOT NULL CHECK (tokens_por_credito > 0),
  peso_entrada        NUMERIC(6, 4) NOT NULL CHECK (peso_entrada >= 0),
  peso_salida         NUMERIC(6, 4) NOT NULL CHECK (peso_salida >= 0),
  vigente_desde       TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por          UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tarifas_vigente_desde ON tarifas_credito_ia(vigente_desde DESC);

-- ----------------------------------------------------------------------------
-- mensajes — se agrega el detalle de consumo del asistente (RF-C8)
-- ----------------------------------------------------------------------------
-- ⚠️ Estas columnas NO están reflejadas todavía en `Message`
-- (types/index.ts) ni en `COLUMNAS_POR_TABLA.mensajes` (db/schema.ts) — se
-- integran juntas cuando se aplique esta migración de verdad, para no
-- romper `db-schema.test.ts` mientras tanto (ver cabecera del archivo).
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS tokens_entrada  INTEGER CHECK (tokens_entrada IS NULL OR tokens_entrada >= 0);
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS tokens_salida   INTEGER CHECK (tokens_salida IS NULL OR tokens_salida >= 0);
-- Quien envió el mensaje = quien paga el consumo (D-C8, P10).
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS pagado_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS tarifa_id       UUID REFERENCES tarifas_credito_ia(id) ON DELETE SET NULL;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS costo_milesimas BIGINT CHECK (costo_milesimas IS NULL OR costo_milesimas >= 0);

-- ----------------------------------------------------------------------------
-- movimientos_credito — LIBRO DE MOVIMIENTOS (solo se inserta, NF-1)
-- ----------------------------------------------------------------------------
-- Va al final porque referencia a casi todas las tablas anteriores.
-- `magnitud` es SIEMPRE >= 0, salvo en 'ajuste_admin' (el admin puede sumar
-- o restar directo). La dirección del efecto la determina `tipo`, no el
-- signo de `magnitud` — ver TipoMovimientoCredito en types/index.ts y las
-- reglas en utils/creditos.ts. Se eligió así (en vez de un delta con signo
-- libre) para que un error de signo al insertar no pueda invertir el efecto
-- de un movimiento.
CREATE TABLE IF NOT EXISTS movimientos_credito (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN (
                    'compra', 'reserva', 'liberacion', 'consumo',
                    'consumo_tokens', 'ajuste_admin', 'reembolso'
                  )),
  magnitud        BIGINT NOT NULL CHECK (tipo = 'ajuste_admin' OR magnitud >= 0),
  compra_id       UUID REFERENCES compras(id) ON DELETE SET NULL,
  invitacion_id   UUID REFERENCES invitaciones_test(id) ON DELETE SET NULL,
  mensaje_id      UUID REFERENCES mensajes(id) ON DELETE SET NULL,
  autor_id        UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo          TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_usuario_producto
  ON movimientos_credito(usuario_id, producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_creado_en ON movimientos_credito(creado_en);

-- ============================================================================
-- SEGURIDAD: Row Level Security activado, SIN políticas todavía (igual que
-- 001_init_schema.sql). Las políticas por rol se agregan cuando se resuelva
-- AD-9/AD-10 (ver 600 PROYECTOS/TAREAS/Re-planificar TASKS para una sola
-- app y módulo de créditos.md) — NF-5 y NF-6 de la SPEC lo exigen antes de
-- exponer cualquier acceso desde el navegador.
-- ============================================================================
ALTER TABLE productos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquetes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones_test   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifas_credito_ia  ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_credito ENABLE ROW LEVEL SECURITY;
