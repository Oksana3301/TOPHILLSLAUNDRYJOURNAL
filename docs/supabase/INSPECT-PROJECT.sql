-- Read-only inventory for the Top Hills project SQL Editor.
-- Does not read customer rows, auth users, secrets, or storage object contents.
-- This is an inspection query, NOT a schema migration.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned table'
            WHEN 'v' THEN 'view' ELSE 'materialized view' END AS object_type,
       c.relrowsecurity AS rls_enabled,
       pg_catalog.has_table_privilege('service_role', c.oid, 'SELECT') AS server_can_select,
       pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
       pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') AS signed_in_can_select
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p', 'v', 'm')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage',
    'extensions', 'realtime', 'supabase_functions', 'supabase_migrations',
    'vault', 'graphql', 'graphql_public', 'pgsodium', 'pgsodium_masks', 'net')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND n.nspname NOT LIKE 'pg_temp_%'
ORDER BY n.nspname, c.relname;
