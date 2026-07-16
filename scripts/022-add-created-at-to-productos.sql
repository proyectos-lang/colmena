-- Migración 022: agregar created_at a productos
--
-- La tabla colmena.productos no tenía columna created_at.
-- Este script la agrega y hace backfill desde transacciones_inventario:
--   - Productos con movimientos: se usa la fecha del primer movimiento (= Fecha real de ingreso)
--   - Productos sin movimientos: se usa now() (fecha de la migración)
--
-- INSTRUCCIONES: ejecutar en el SQL Editor de Supabase antes del próximo deploy.

ALTER TABLE colmena.productos
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill: usar la fecha del primer movimiento de inventario como "Fecha ingreso"
UPDATE colmena.productos p
SET created_at = (
  SELECT MIN(ti.fecha)
  FROM colmena.transacciones_inventario ti
  WHERE ti.producto_id = p.id
)
WHERE EXISTS (
  SELECT 1
  FROM colmena.transacciones_inventario ti
  WHERE ti.producto_id = p.id
);
