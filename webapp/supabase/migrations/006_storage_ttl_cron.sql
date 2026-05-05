-- Enable pg_cron extension (creates schema 'cron')
create extension if not exists pg_cron with schema extensions;

-- Function: limpia objetos antiguos de storage y registros antiguos de runs
create or replace function public.cleanup_old_runs_and_storage()
returns json
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  removed_inputs int := 0;
  removed_outputs int := 0;
  removed_runs int := 0;
begin
  -- Storage objects > 7 días
  with del as (
    delete from storage.objects
    where bucket_id in ('inputs','outputs')
      and created_at < now() - interval '7 days'
    returning bucket_id
  )
  select
    count(*) filter (where bucket_id = 'inputs'),
    count(*) filter (where bucket_id = 'outputs')
  into removed_inputs, removed_outputs
  from del;

  -- process_runs y sus logs > 30 días
  with del_runs as (
    delete from public.process_runs
    where created_at < now() - interval '30 days'
    returning id
  )
  select count(*) into removed_runs from del_runs;

  return json_build_object(
    'removed_inputs', removed_inputs,
    'removed_outputs', removed_outputs,
    'removed_runs', removed_runs,
    'ran_at', now()
  );
end;
$$;

-- Programar el job: cada día a las 03:15 UTC
select cron.schedule(
  'cleanup-old-storage-and-runs',
  '15 3 * * *',
  $cron$ select public.cleanup_old_runs_and_storage(); $cron$
);

comment on function public.cleanup_old_runs_and_storage is
  'Limpia archivos de storage en buckets inputs/outputs > 7 días y process_runs > 30 días. Ejecutado por pg_cron diariamente a las 03:15 UTC.';
