-- Tabla de conceptos de gasto
CREATE TABLE IF NOT EXISTS conceptos_gastos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  categoria_macro VARCHAR(50) NOT NULL CHECK (categoria_macro IN ('Servicios', 'Publicidad', 'Nomina', 'Arriendo', 'Mantenimiento', 'Impuestos', 'Suministros', 'Otros')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de gastos
CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  concepto_id INTEGER NOT NULL REFERENCES conceptos_gastos(id) ON DELETE RESTRICT,
  fecha_gasto DATE NOT NULL,
  monto DECIMAL(12, 2) NOT NULL CHECK (monto > 0),
  metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('Efectivo', 'Transferencia', 'Tarjeta')),
  descripcion TEXT,
  comprobante_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha_gasto);
CREATE INDEX IF NOT EXISTS idx_gastos_concepto ON gastos(concepto_id);

-- Insertar conceptos de ejemplo
INSERT INTO conceptos_gastos (nombre, categoria_macro) VALUES
  ('Pago de Internet', 'Servicios'),
  ('Pago de Luz', 'Servicios'),
  ('Pago de Agua', 'Servicios'),
  ('Alquiler Local', 'Arriendo'),
  ('Publicidad Facebook', 'Publicidad'),
  ('Salarios', 'Nomina'),
  ('Papeleria', 'Suministros'),
  ('Reparaciones', 'Mantenimiento')
ON CONFLICT DO NOTHING;
