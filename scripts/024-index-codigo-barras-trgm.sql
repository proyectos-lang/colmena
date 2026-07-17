-- Migracion 024: indice trigram en codigo_barras
--
-- La busqueda de la lupa en ventas usa ILIKE (sin comodines) sobre
-- codigo_barras para hacer coincidencia exacta insensible a mayusculas.
-- Un indice B-Tree normal no acelera ILIKE; el indice GIN trigram si.
-- Requiere la extension pg_trgm (creada en la migracion 023).
--
-- INSTRUCCIONES: ejecutar en el SQL Editor de Supabase antes del proximo deploy.

CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras_trgm
  ON colmena.productos USING GIN (codigo_barras gin_trgm_ops);
