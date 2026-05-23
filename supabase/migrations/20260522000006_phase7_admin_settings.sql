-- Phase 7: admin settings

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.app_settings;
create trigger set_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

insert into public.app_settings (key, value)
values (
  'system',
  jsonb_build_object(
    'require_costs_before_close', true,
    'require_customs_document', false,
    'delayed_after_eta_days', 0
  )
)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
for select to authenticated using (true);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

grant all on table public.app_settings to authenticated;
grant all on table public.app_settings to service_role;
