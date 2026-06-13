-- ============================================
-- Agregar columna logo_url a razon_social
-- y crear bucket de storage 'logos'
-- ============================================

-- 1. Agregar columna logo_url si no existe
ALTER TABLE razon_social
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Agregar columna rol a usuarios si no existe (para mostrar en la tabla)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'Usuario';

-- 3. Crear bucket publico 'logos' para almacenar imagenes de empresas
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Politica: permitir lectura publica de los logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read logos'
  ) THEN
    CREATE POLICY "Public read logos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'logos');
  END IF;
END $$;

-- 5. Politica: permitir insert/update/delete de logos a cualquier usuario (ajustar en produccion)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public write logos'
  ) THEN
    CREATE POLICY "Public write logos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public update logos'
  ) THEN
    CREATE POLICY "Public update logos"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public delete logos'
  ) THEN
    CREATE POLICY "Public delete logos"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'logos');
  END IF;
END $$;
