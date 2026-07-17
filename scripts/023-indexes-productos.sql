-- Migracion 023: indices de rendimiento en colmena.productos
--
-- Soluciona sequential scans causados por busquedas ILIKE sin indice.
-- pg_trgm habilita indices GIN para busquedas %texto% en nombre.
-- Los indices en FKs aceleran JOINs con marcas, categorias y emprendimientos.
--
-- INSTRUCCIONES: ejecutar en el SQL Editor de Supabase antes del proximo deploy.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm
  ON colmena.productos USING GIN (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras
  ON colmena.productos (codigo_barras);

CREATE INDEX IF NOT EXISTS idx_productos_marca_id
  ON colmena.productos (marca_id);

CREATE INDEX IF NOT EXISTS idx_productos_categoria_id
  ON colmena.productos (categoria_id);

CREATE INDEX IF NOT EXISTS idx_productos_emprendimiento_id
  ON colmena.productos (emprendimiento_id);
