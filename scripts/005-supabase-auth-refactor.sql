-- ============================================
-- Refactorizar usuarios para usar Supabase Auth
-- ============================================
-- - Agrega columna auth_user_id UUID que enlaza con auth.users
-- - Elimina columna password (ya no se guarda localmente)
-- - Crea usuario admin@easycount.com / admin123 en auth.users y lo enlaza

-- 1. Habilitar extensiones necesarias para crypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Agregar columna auth_user_id si no existe
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- 3. Eliminar columna password (obsoleta; Supabase Auth gestiona credenciales)
ALTER TABLE usuarios DROP COLUMN IF EXISTS password;

-- 4. Crear usuario admin en auth.users y enlazar con usuarios
DO $$
DECLARE
  v_admin_uid UUID;
  v_existing_id INTEGER;
  v_rs_id INTEGER;
BEGIN
  -- Buscar si el admin ya existe en auth.users
  SELECT id INTO v_admin_uid FROM auth.users WHERE email = 'admin@easycount.com' LIMIT 1;

  IF v_admin_uid IS NULL THEN
    v_admin_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_admin_uid,
      'authenticated',
      'authenticated',
      'admin@easycount.com',
      crypt('admin123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Administrador"}'::jsonb,
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Obtener primera razon_social (o NULL si no hay)
  SELECT id INTO v_rs_id FROM razon_social ORDER BY id LIMIT 1;

  -- Buscar si ya hay un usuario con email admin (viejo colorbag o nuevo easycount)
  SELECT id INTO v_existing_id
    FROM usuarios
   WHERE email IN ('admin@colorbag.com', 'admin@easycount.com')
   ORDER BY id LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Actualizar: enlazar con auth.users y normalizar email
    UPDATE usuarios
       SET auth_user_id = v_admin_uid,
           email = 'admin@easycount.com',
           nombre = COALESCE(nombre, 'Administrador'),
           razon_social_id = COALESCE(razon_social_id, v_rs_id),
           activo = TRUE
     WHERE id = v_existing_id;
  ELSE
    INSERT INTO usuarios (email, nombre, razon_social_id, auth_user_id, activo)
    VALUES ('admin@easycount.com', 'Administrador', v_rs_id, v_admin_uid, TRUE);
    SELECT id INTO v_existing_id FROM usuarios WHERE auth_user_id = v_admin_uid;
  END IF;

  -- Asegurar permisos completos para el admin
  INSERT INTO permisos_usuarios (usuario_id, modulo_id, puede_ver)
  SELECT v_existing_id, m.id, TRUE
    FROM modulos m
  ON CONFLICT (usuario_id, modulo_id) DO UPDATE SET puede_ver = TRUE;
END $$;

-- 5. Indice para lookup rapido por auth_user_id
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON usuarios(auth_user_id);
