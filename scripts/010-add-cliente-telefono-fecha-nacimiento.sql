-- ============================================================================
-- Migration: agregar telefono y fecha_nacimiento a clientes (CRM/fidelizacion)
-- ============================================================================
-- Idempotente: usa IF NOT EXISTS para soportar re-ejecucion.
--
-- Justificacion:
--  * `telefono`: campo opcional para contacto directo (string libre, sin
--    validacion de formato a nivel DB; se guarda lo que el usuario digite).
--  * `fecha_nacimiento`: tipo DATE (sin hora). Permite calcular cumpleanos
--    ignorando el ano (solo mes/dia) en el frontend para alertas de
--    fidelizacion.
-- ============================================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS telefono TEXT;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

-- Indice ligero para acelerar el filtrado de cumpleanos por mes/dia.
-- Usamos to_char(fecha_nacimiento, 'MM-DD') para indice funcional.
CREATE INDEX IF NOT EXISTS idx_clientes_cumple_mmdd
  ON clientes (to_char(fecha_nacimiento, 'MM-DD'))
  WHERE fecha_nacimiento IS NOT NULL;

-- Verificacion
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'clientes'
  AND column_name IN ('telefono', 'fecha_nacimiento')
ORDER BY column_name;
