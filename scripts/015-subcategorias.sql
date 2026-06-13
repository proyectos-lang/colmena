-- =========================================================
-- Script 015: Subcategorias en Inventario / Productos
-- =========================================================
-- Crea la tabla `subcategorias` (categoria_id padre + razon_social_id
-- multi-tenant) y agrega `productos.subcategoria_id` opcional. La FK queda
-- en ON DELETE SET NULL: si una subcategoria desaparece, los productos no
-- pierden la categoria principal, solo quedan sin subcategoria.
--
-- Aislamiento multi-tenant
-- ------------------------
-- Cada subcategoria pertenece a la razon social del usuario que la crea.
-- El UNIQUE compuesto incluye razon_social_id + categoria_id para que dos
-- empresas distintas puedan reusar el mismo nombre de subcategoria sin
-- conflicto, y para que la misma subcategoria pueda existir bajo dos
-- categorias diferentes dentro del mismo tenant.
--
-- Idempotencia
-- ------------
-- Todo va con IF NOT EXISTS / DO blocks. Re-ejecutar este script no rompe
-- nada y no recrea datos.

CREATE TABLE IF NOT EXISTS subcategorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  razon_social_id INTEGER REFERENCES razones_sociales(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Una subcategoria es unica DENTRO de su categoria padre y su tenant.
-- (Por seguridad la creamos por nombre + categoria + razon_social.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_subcategorias_tenant_categoria_nombre
  ON subcategorias(razon_social_id, categoria_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria_id
  ON subcategorias(categoria_id);

CREATE INDEX IF NOT EXISTS idx_subcategorias_razon_social
  ON subcategorias(razon_social_id);

-- =========================================================
-- productos.subcategoria_id
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name = 'productos'
       AND column_name = 'subcategoria_id'
  ) THEN
    ALTER TABLE productos
      ADD COLUMN subcategoria_id INTEGER
        REFERENCES subcategorias(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_productos_subcategoria_id
  ON productos(subcategoria_id);
