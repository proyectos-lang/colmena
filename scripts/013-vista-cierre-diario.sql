-- =========================================================
-- Script 012: Vista Cierre Diario + permiso
-- =========================================================
-- 1. vista_cierre_diario  -> resumen agregado por (razon_social_id, fecha)
--    de ventas, tickets, efectivo cobrado, bruto/neto bancario y comisiones.
-- 2. modulos              -> agrega 'Cierre Diario'.
--
-- IMPORTANTE: depende del script 011 (necesita ventas_pagos_detalle).
-- Si por alguna razon 011 no se aplico, esta vista quedara vacia para los
-- montos por metodo, pero seguira mostrando ventas/tickets totales.
-- =========================================================

-- Borramos para garantizar que la definicion siempre quede al dia con la
-- ultima version del script (la vista no es destructiva, solo se redefine).
DROP VIEW IF EXISTS vista_cierre_diario;

CREATE VIEW vista_cierre_diario AS
WITH ventas_dia AS (
  SELECT
    v.razon_social_id,
    (v.fecha_venta AT TIME ZONE 'UTC')::date AS fecha,
    COUNT(*)::int                            AS cantidad_tickets,
    COALESCE(SUM(v.total_venta), 0)          AS total_ventas
  FROM ventas_encabezado v
  GROUP BY v.razon_social_id, (v.fecha_venta AT TIME ZONE 'UTC')::date
),
pagos_dia AS (
  SELECT
    p.razon_social_id,
    (v.fecha_venta AT TIME ZONE 'UTC')::date AS fecha,
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'Efectivo' THEN p.monto_bruto ELSE 0 END), 0) AS efectivo_bruto,
    COALESCE(SUM(CASE WHEN p.metodo_pago IN ('Banco','Link_Pago') THEN p.monto_bruto ELSE 0 END), 0) AS banco_bruto,
    COALESCE(SUM(CASE WHEN p.metodo_pago IN ('Banco','Link_Pago') THEN p.monto_neto  ELSE 0 END), 0) AS banco_neto,
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'Credito' THEN p.monto_bruto ELSE 0 END), 0) AS credito_total,
    COALESCE(SUM(p.monto_bruto - p.monto_neto), 0) AS comisiones_total
  FROM ventas_pagos_detalle p
  JOIN ventas_encabezado v ON v.id = p.venta_id
  GROUP BY p.razon_social_id, (v.fecha_venta AT TIME ZONE 'UTC')::date
)
SELECT
  vd.razon_social_id,
  vd.fecha,
  vd.cantidad_tickets,
  vd.total_ventas,
  COALESCE(pd.efectivo_bruto, 0)   AS ingresos_efectivo,
  COALESCE(pd.banco_bruto, 0)      AS ingresos_banco_bruto,
  COALESCE(pd.banco_neto, 0)       AS ingresos_banco_neto,
  COALESCE(pd.credito_total, 0)    AS credito_total,
  COALESCE(pd.comisiones_total, 0) AS comisiones_total
FROM ventas_dia vd
LEFT JOIN pagos_dia pd
  ON pd.razon_social_id = vd.razon_social_id
 AND pd.fecha           = vd.fecha;

COMMENT ON VIEW vista_cierre_diario IS
  'Resumen diario por razon social: ventas, tickets, ingresos efectivo/banco neto y comisiones.';

-- =========================================================
-- 2. Permiso: Cierre Diario
-- =========================================================
INSERT INTO modulos (nombre, descripcion) VALUES
  ('Cierre Diario', 'Cierre diario de operaciones: ventas, bancos, productos, caja chica')
ON CONFLICT (nombre) DO NOTHING;
