-- Create marcas table
CREATE TABLE IF NOT EXISTS marcas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create categorias table
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add marca_id and categoria_id columns to productos table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='productos' AND column_name='marca_id') THEN
    ALTER TABLE productos ADD COLUMN marca_id INTEGER REFERENCES marcas(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='productos' AND column_name='categoria_id') THEN
    ALTER TABLE productos ADD COLUMN categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_productos_marca_id ON productos(marca_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id);

-- Insert some default categorias for ColorBag
INSERT INTO categorias (nombre, descripcion) VALUES
  ('Bolsos', 'Bolsos y carteras'),
  ('Mochilas', 'Mochilas y bolsos deportivos'),
  ('Accesorios', 'Accesorios y complementos'),
  ('Billeteras', 'Billeteras y monederos')
ON CONFLICT (nombre) DO NOTHING;

-- Insert some default marcas
INSERT INTO marcas (nombre, descripcion) VALUES
  ('ColorBag', 'Marca propia'),
  ('Generica', 'Marca generica')
ON CONFLICT (nombre) DO NOTHING;
