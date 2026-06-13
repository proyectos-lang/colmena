-- =========================================================
-- Script 009: Agrega columna `valorpago` a ventas_encabezado
-- =========================================================
-- Propositos:
--   1. Permitir capturar el pago inicial (abono) al momento de crear
--      la venta, sin forzar a registrar un pago en `pagos_ventas`.
--   2. `valorpago` representa el "total pagado acumulado" de la venta:
--        - Al crear: 0 (Credito), parcial (Parcial), total (Contado)
--        - Al registrar pagos posteriores se incrementa.
--   3. El saldo pendiente de una venta es:
--        saldo = total_venta - COALESCE(valorpago, 0)
--
-- La columna es NUMERIC(14,2) con default 0 para que las filas
-- existentes no queden con NULL y los calculos de cartera sigan
-- funcionando sin cambios adicionales.
-- =========================================================

ALTER TABLE ventas_encabezado
  ADD COLUMN IF NOT EXISTS valorpago NUMERIC(14, 2) NOT NULL DEFAULT 0;

-- Indice opcional para queries de cartera (ventas con saldo > 0).
-- Acelera filtros tipo `WHERE total_venta > valorpago`.
CREATE INDEX IF NOT EXISTS idx_ventas_saldo
  ON ventas_encabezado ((total_venta - valorpago))
  WHERE total_venta > valorpago;

-- Backfill: para ventas historicas ya marcadas como 'Pagado' que no
-- tengan registros en pagos_ventas, asumimos que `valorpago` = total_venta
-- para que el saldo muestre 0. No tocamos las que tengan pagos_ventas
-- porque ya estan representadas correctamente.
UPDATE ventas_encabezado v
SET valorpago = v.total_venta
WHERE v.estado_pago = 'Pagado'
  AND COALESCE(v.valorpago, 0) = 0
  AND NOT EXISTS (
    SELECT 1 FROM pagos_ventas p WHERE p.venta_id = v.id
  );

-- Backfill: para ventas 'Parcial' sin pagos_ventas, dejamos valorpago en 0
-- (no hay forma de inferir el monto real). El usuario debera ajustar
-- manualmente si es necesario.

COMMENT ON COLUMN ventas_encabezado.valorpago IS
  'Total pagado acumulado de la venta. saldo = total_venta - valorpago';
