-- =========================================================
-- Script 014: Cuentas por Pagar
-- =========================================================
-- Convierte el modulo de Gastos en un sistema de Cuentas por Pagar:
--   1. Agrega columnas a `gastos`:
--        - proveedor_nombre, numero_factura
--        - fecha_vencimiento
--        - monto_pagado, estado_pago
--   2. Crea `gastos_pagos_detalle` (historial de abonos por gasto).
--   3. Crea la vista `vista_cuentas_por_pagar` (deuda viva, ordenada por
--      fecha de vencimiento).
--   4. Agrega los modulos granulares 'Cuentas por Pagar' (visible en sidebar
--      como sub-pestana del modulo de Gastos en la UI).
--
-- Idempotente: usa IF NOT EXISTS / DO blocks / ON CONFLICT.
-- =========================================================

-- =========================================================
-- 1. ALTER gastos: nuevas columnas para AP
-- =========================================================
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS proveedor_nombre  TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS numero_factura    TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS monto_pagado      NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS estado_pago       TEXT NOT NULL DEFAULT 'Pendiente';

-- Refuerzo del check (idempotente: dropea si existe y vuelve a crearlo).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gastos_estado_pago_check'
  ) THEN
    ALTER TABLE gastos DROP CONSTRAINT gastos_estado_pago_check;
  END IF;
  ALTER TABLE gastos ADD CONSTRAINT gastos_estado_pago_check
    CHECK (estado_pago IN ('Pendiente','Parcial','Pagado'));
END$$;

-- Backfill: gastos viejos quedan como 'Pagado' con monto_pagado = monto.
-- Asumimos que si alguien registro un gasto sin AP, ya estaba pagado.
UPDATE gastos
   SET monto_pagado = monto,
       estado_pago  = 'Pagado'
 WHERE estado_pago = 'Pendiente'
   AND monto_pagado = 0
   AND created_at < now() - INTERVAL '1 minute'; -- evita pisar registros nuevos

CREATE INDEX IF NOT EXISTS idx_gastos_estado_pago
  ON gastos(estado_pago) WHERE estado_pago <> 'Pagado';
CREATE INDEX IF NOT EXISTS idx_gastos_fecha_vencimiento
  ON gastos(fecha_vencimiento) WHERE fecha_vencimiento IS NOT NULL;

-- =========================================================
-- 2. gastos_pagos_detalle (historial de abonos)
-- =========================================================
CREATE TABLE IF NOT EXISTS gastos_pagos_detalle (
  id                    SERIAL PRIMARY KEY,
  razon_social_id       INTEGER NOT NULL REFERENCES razon_social(id) ON DELETE CASCADE,
  gasto_id              INTEGER NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
  fecha_pago            TIMESTAMPTZ NOT NULL DEFAULT now(),
  monto                 NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  metodo_pago           TEXT NOT NULL CHECK (metodo_pago IN ('Efectivo','Banco','Otro')),
  cuenta_id             INTEGER REFERENCES cuentas_config(id),
  -- Trazabilidad cruzada con caja chica / cuentas bancarias (si aplica).
  caja_movimiento_id    INTEGER,
  cuenta_movimiento_id  INTEGER,
  concepto              TEXT,
  usuario               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gastos_pagos_gasto
  ON gastos_pagos_detalle(gasto_id);
CREATE INDEX IF NOT EXISTS idx_gastos_pagos_fecha
  ON gastos_pagos_detalle(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_gastos_pagos_razon_social
  ON gastos_pagos_detalle(razon_social_id);

COMMENT ON TABLE gastos_pagos_detalle IS
  'Historial de abonos a cada factura de gasto. La suma actualiza gastos.monto_pagado y estado_pago via service-side.';

-- =========================================================
-- 3. vista_cuentas_por_pagar
-- =========================================================
-- Deuda viva: gastos cuyo estado <> 'Pagado'. Calcula saldo_pendiente y
-- dias_vencido (negativo = aun no vence; positivo = vencida).
DROP VIEW IF EXISTS vista_cuentas_por_pagar;
CREATE VIEW vista_cuentas_por_pagar AS
SELECT
  g.id,
  g.razon_social_id,
  g.concepto_id,
  c.nombre            AS concepto_nombre,
  c.categoria_macro,
  g.proveedor_nombre,
  g.numero_factura,
  g.fecha_gasto,
  g.fecha_vencimiento,
  g.monto,
  g.monto_pagado,
  (g.monto - g.monto_pagado)::NUMERIC(14,2) AS saldo_pendiente,
  g.estado_pago,
  g.descripcion,
  g.comprobante_url,
  CASE
    WHEN g.fecha_vencimiento IS NULL THEN NULL
    ELSE (CURRENT_DATE - g.fecha_vencimiento)::INTEGER
  END                 AS dias_vencido,
  g.created_at
FROM gastos g
LEFT JOIN conceptos_gastos c ON c.id = g.concepto_id
WHERE g.estado_pago <> 'Pagado'
ORDER BY
  -- Vencidas primero (dias_vencido > 0), luego por fecha de vencimiento ASC,
  -- y al final las que no tienen fecha definida.
  CASE WHEN g.fecha_vencimiento IS NULL THEN 1 ELSE 0 END,
  g.fecha_vencimiento ASC NULLS LAST,
  g.fecha_gasto ASC;

-- =========================================================
-- 4. Permiso: agrega 'Cuentas por Pagar' a modulos
-- =========================================================
INSERT INTO modulos (nombre, descripcion) VALUES
  ('Cuentas por Pagar', 'Sub-modulo de Gastos: facturas pendientes y abonos a proveedores')
ON CONFLICT (nombre) DO NOTHING;
