-- Admin-only SQL executor used by the migration dump tool.
-- Returns query results as jsonb. Only callable by service_role.
CREATE OR REPLACE FUNCTION public.admin_exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, information_schema
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ') t'
    INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_exec_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exec_sql(text) TO service_role;