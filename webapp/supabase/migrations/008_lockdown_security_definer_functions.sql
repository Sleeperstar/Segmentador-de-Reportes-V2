-- Revocar EXECUTE de anon en funciones que no deben ser públicas
revoke execute on function public.check_rate_limit(text, int, int) from anon, public;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;

revoke execute on function public.cleanup_old_runs_and_storage() from anon, public, authenticated;
grant execute on function public.cleanup_old_runs_and_storage() to postgres;

revoke execute on function public.handle_new_user() from anon, public, authenticated;

revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;
