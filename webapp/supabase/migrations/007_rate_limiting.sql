-- Tabla para rate limiting con ventana deslizante por hash de ventana
create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, endpoint, window_start)
);

create index if not exists idx_api_rate_limits_lookup
  on public.api_rate_limits (user_id, endpoint, window_start desc);

alter table public.api_rate_limits enable row level security;

drop policy if exists "users_can_read_own_rate_limits" on public.api_rate_limits;
create policy "users_can_read_own_rate_limits"
  on public.api_rate_limits for select
  using (auth.uid() = user_id);

-- Función: chequea y registra una llamada bajo una ventana fija de N segundos.
-- Retorna { allowed boolean, count int, max int, retry_after_seconds int }.
create or replace function public.check_rate_limit(
  p_endpoint text,
  p_max int,
  p_window_seconds int
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_window_start timestamptz;
  v_count int;
  v_remaining_seconds int;
begin
  if v_user is null then
    return json_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  if random() < 0.05 then
    delete from public.api_rate_limits
    where window_start < now() - interval '1 day';
  end if;

  insert into public.api_rate_limits (user_id, endpoint, window_start, count)
  values (v_user, p_endpoint, v_window_start, 1)
  on conflict (user_id, endpoint, window_start)
  do update set count = api_rate_limits.count + 1
  returning count into v_count;

  if v_count > p_max then
    v_remaining_seconds := greatest(
      1,
      ceil(extract(epoch from (v_window_start + (p_window_seconds || ' seconds')::interval - now())))::int
    );
    return json_build_object(
      'allowed', false,
      'count', v_count,
      'max', p_max,
      'retry_after_seconds', v_remaining_seconds
    );
  end if;

  return json_build_object(
    'allowed', true,
    'count', v_count,
    'max', p_max
  );
end;
$$;

grant execute on function public.check_rate_limit(text, int, int) to authenticated;

comment on function public.check_rate_limit is
  'Implementa rate limiting fijo por ventana. Llamar al inicio de una API route. Retorna allowed=true|false con metadata.';
