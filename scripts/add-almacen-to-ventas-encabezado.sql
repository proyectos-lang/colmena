-- Add almacen_id column to ventas_encabezado table
-- This stores the warehouse from which the sale was dispatched

ALTER TABLE ventas_encabezado 
ADD COLUMN IF NOT EXISTS almacen_id INTEGER REFERENCES almacenes(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ventas_encabezado_almacen 
ON ventas_encabezado(almacen_id);
