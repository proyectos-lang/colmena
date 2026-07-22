-- Migracion 025: exponer TODOS los esquemas de usuario en la Data API (PostgREST)
--
-- Script dinamico e idempotente. Detecta automaticamente todos los esquemas
-- creados en el proyecto (excluyendo los internos de Postgres/Supabase) y los
-- expone en la API REST. Incluye siempre `public` y `graphql_public`.
--
-- USO: cada vez que agregues un esquema nuevo (un cliente nuevo), simplemente
-- vuelve a ejecutar este script completo en el SQL Editor de Supabase. Detectara
-- el nuevo esquema y lo expondra, sin necesidad de tocar el toggle del dashboard.
--
-- Nota: este ajuste es un PUNTO UNICO para todos los clientes que comparten el
-- proyecto. El toggle "Exposed schemas" del dashboard escribe en el mismo lugar;
-- prefiere SIEMPRE este script para no perder esquemas por error.

DO $$
DECLARE
  schema_list text;
BEGIN
  SELECT string_agg(
           nspname,
           ', '
           ORDER BY
             CASE nspname
               WHEN 'public' THEN 0
               WHEN 'graphql_public' THEN 1
               ELSE 2
             END,
             nspname
         )
    INTO schema_list
    FROM pg_namespace
   WHERE nspname NOT LIKE 'pg_%'                 -- pg_catalog, pg_toast, pg_temp_*, etc.
     AND nspname <> 'information_schema'
     AND nspname NOT IN (                         -- esquemas internos de Supabase (NO exponer)
       'auth', 'storage', 'realtime', '_realtime',
       'supabase_functions', 'supabase_migrations',
       'extensions', 'graphql', 'vault', 'pgbouncer',
       'pgsodium', 'pgsodium_masks', 'cron', 'net',
       '_analytics', '_supavisor'
     );

  -- Aplica la lista completa al rol que usa PostgREST.
  EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', schema_list);

  -- Revisa este NOTICE en la salida: confirma que solo aparezcan esquemas que
  -- realmente quieras exponer (por si Supabase agrega alguno interno nuevo).
  RAISE NOTICE 'Esquemas expuestos: %', schema_list;
END $$;

-- Aplicar los cambios en caliente (config = que esquemas, schema = tablas dentro).
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
