-- ============================================
-- Tablas para autenticacion y permisos modulares
-- ============================================

-- Tabla de modulos del sistema
CREATE TABLE IF NOT EXISTS modulos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nombre TEXT NOT NULL,
  razon_social_id INTEGER REFERENCES razon_social(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla pivote de permisos usuario-modulo
CREATE TABLE IF NOT EXISTS permisos_usuarios (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo_id INTEGER NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
  puede_ver BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, modulo_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_permisos_usuario ON permisos_usuarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Seed modulos (coincide con la navegacion del sidebar)
INSERT INTO modulos (nombre, descripcion, orden) VALUES
  ('Dashboard', 'Panel principal con KPIs', 1),
  ('Ventas', 'Gestion de ventas y cobros', 2),
  ('Compras', 'Ordenes de compra y recepcion', 3),
  ('Inventario', 'Kardex, ingresos y traslados', 4),
  ('Finanzas', 'Gastos y estado de resultados', 5),
  ('Configuracion', 'Catalogos y parametros', 6)
ON CONFLICT (nombre) DO NOTHING;

-- Seed usuario admin por defecto (email: admin@colorbag.com / password: admin123)
-- NOTA: En produccion reemplazar password plano por hash bcrypt
INSERT INTO usuarios (email, password, nombre, razon_social_id)
SELECT 'admin@colorbag.com', 'admin123', 'Administrador', (SELECT id FROM razon_social LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@colorbag.com');

-- Otorgar al admin todos los permisos
INSERT INTO permisos_usuarios (usuario_id, modulo_id, puede_ver)
SELECT 
  (SELECT id FROM usuarios WHERE email = 'admin@colorbag.com'),
  m.id,
  TRUE
FROM modulos m
ON CONFLICT (usuario_id, modulo_id) DO NOTHING;
