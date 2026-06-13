-- ============================================
-- FASE 3: Refactorizacion Multi-Tenant
-- Agrega razon_social_id a todas las tablas del sistema
-- para asegurar el aislamiento de datos por empresa.
-- ============================================

-- ---------- CATALOGOS ----------
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

ALTER TABLE marcas
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

ALTER TABLE almacenes
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

ALTER TABLE localizaciones
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

-- ---------- VENTAS ----------
ALTER TABLE ventas_encabezado
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

-- ---------- COMPRAS ----------
ALTER TABLE compras_encabezado
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

-- ---------- INVENTARIO ----------
ALTER TABLE transacciones_inventario
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

-- ---------- FINANZAS ----------
ALTER TABLE conceptos_gastos
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE CASCADE;

-- ---------- MIGRAR DATOS EXISTENTES ----------
-- Asigna todos los registros huerfanos a la primera razon_social existente
DO $$
DECLARE
  default_rs_id INTEGER;
BEGIN
  SELECT id INTO default_rs_id FROM razon_social ORDER BY id ASC LIMIT 1;

  IF default_rs_id IS NOT NULL THEN
    UPDATE productos          SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE marcas             SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE categorias         SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE almacenes          SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE localizaciones     SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE clientes           SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE proveedores        SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE ventas_encabezado  SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE compras_encabezado SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE transacciones_inventario SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE conceptos_gastos   SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
    UPDATE gastos             SET razon_social_id = default_rs_id WHERE razon_social_id IS NULL;
  END IF;
END $$;

-- ---------- INDICES PARA PERFORMANCE ----------
CREATE INDEX IF NOT EXISTS idx_productos_razon_social          ON productos(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_marcas_razon_social             ON marcas(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_categorias_razon_social         ON categorias(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_almacenes_razon_social          ON almacenes(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_localizaciones_razon_social     ON localizaciones(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_clientes_razon_social           ON clientes(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_razon_social        ON proveedores(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_ventas_enc_razon_social         ON ventas_encabezado(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_compras_enc_razon_social        ON compras_encabezado(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_trans_inv_razon_social          ON transacciones_inventario(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_conceptos_gastos_razon_social   ON conceptos_gastos(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_gastos_razon_social             ON gastos(razon_social_id);
