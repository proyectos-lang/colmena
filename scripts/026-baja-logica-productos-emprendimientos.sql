-- Migracion 026: baja logica de productos + normalizar activo de emprendimientos
--
-- Al "eliminar" un emprendimiento ahora se DESACTIVA (no se borra) y sus productos
-- se ocultan con baja logica, conservando el historial de ventas (ventas_detalle
-- sigue referenciando la fila del producto para mostrar su nombre).
--
-- INSTRUCCIONES: ejecutar en el SQL Editor de Supabase antes del proximo deploy.

-- Columna de baja logica en productos (todos los existentes quedan activos).
ALTER TABLE colmena.productos
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_productos_activo ON colmena.productos (activo);

-- Normalizar emprendimientos.activo para poder filtrar por = true de forma segura.
UPDATE colmena.emprendimientos SET activo = true WHERE activo IS NULL;

ALTER TABLE colmena.emprendimientos
  ALTER COLUMN activo SET DEFAULT true,
  ALTER COLUMN activo SET NOT NULL;
