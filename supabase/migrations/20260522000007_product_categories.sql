-- Product categories are independent lookup data.
-- Products still keep a text category and must not get supplier_id.

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

