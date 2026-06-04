-- Run once in Supabase → SQL Editor if you see:
-- "Could not find the table 'public.product_categories' in the schema cache"
-- (Also creates app_settings if migration 06 was skipped.)

-- === 06: app_settings ===
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

-- === profiles.user_code (migration 09) ===
alter table public.profiles add column if not exists user_code text unique;

-- === 07: product_categories ===
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  code text unique,
  parent_id uuid references public.product_categories (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_categories_parent_idx
  on public.product_categories (parent_id);

create index if not exists product_categories_name_ar_trgm
  on public.product_categories using gin (name_ar gin_trgm_ops);

drop trigger if exists set_updated_at on public.product_categories;
create trigger set_updated_at before update on public.product_categories
for each row execute function public.set_updated_at();

alter table public.product_categories enable row level security;

drop policy if exists product_categories_select on public.product_categories;
create policy product_categories_select on public.product_categories
for select to authenticated using (true);

drop policy if exists product_categories_write on public.product_categories;
create policy product_categories_write on public.product_categories
for all to authenticated
using (public.can_write()) with check (public.can_write());

grant all on table public.product_categories to authenticated;
grant all on table public.product_categories to service_role;
