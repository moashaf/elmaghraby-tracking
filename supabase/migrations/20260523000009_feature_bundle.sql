-- Feature bundle: shipping routes, shipment totals, codes, shipment_type text

-- Shipping routes (lookup for ETA)
create table if not exists public.shipping_routes (
  id uuid primary key default gen_random_uuid(),
  shipping_port text not null,
  arrival_port text not null,
  duration_days int not null check (duration_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shipping_port, arrival_port)
);

drop trigger if exists set_updated_at on public.shipping_routes;
create trigger set_updated_at before update on public.shipping_routes
for each row execute function public.set_updated_at();

alter table public.shipping_routes enable row level security;

drop policy if exists shipping_routes_select on public.shipping_routes;
create policy shipping_routes_select on public.shipping_routes
for select to authenticated using (true);

drop policy if exists shipping_routes_write on public.shipping_routes;
create policy shipping_routes_write on public.shipping_routes
for all to authenticated
using (public.can_write()) with check (public.can_write());

grant all on table public.shipping_routes to authenticated;
grant all on table public.shipping_routes to service_role;

-- Shipments: cargo description text + totals
alter table public.shipments drop constraint if exists shipments_shipment_type_check;
alter table public.shipments alter column shipment_type drop default;
alter table public.shipments alter column shipment_type type text using shipment_type::text;

alter table public.shipments add column if not exists total_weight_kg numeric(12, 2);
alter table public.shipments add column if not exists total_cartons int;

-- Entity codes
alter table public.suppliers add column if not exists code text unique;
alter table public.profiles add column if not exists user_code text unique;
alter table public.products add column if not exists category_id uuid references public.product_categories (id) on delete set null;

create table if not exists public.entity_code_sequences (
  scope text primary key,
  prefix text not null default '',
  last_value int not null default 0
);

insert into public.entity_code_sequences (scope, prefix, last_value)
values
  ('company', 'CMP', 0),
  ('supplier', 'SUP', 0),
  ('profile', 'USR', 0)
on conflict (scope) do nothing;

create or replace function public.next_entity_code(p_scope text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_val int;
begin
  insert into public.entity_code_sequences (scope, prefix, last_value)
  values (p_scope, p_prefix, 1)
  on conflict (scope) do update
    set last_value = public.entity_code_sequences.last_value + 1
  returning last_value into next_val;

  return p_prefix || '-' || lpad(next_val::text, 4, '0');
end;
$$;

create or replace function public.next_product_sku(p_category_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cat_code text;
  prefix text;
  scope_key text;
begin
  if p_category_id is not null then
    select coalesce(nullif(trim(code), ''), 'PRD')
    into cat_code
    from public.product_categories
    where id = p_category_id;
  else
    cat_code := 'PRD';
  end if;

  prefix := upper(regexp_replace(cat_code, '[^A-Za-z0-9]', '', 'g'));
  if prefix = '' or prefix is null then
    prefix := 'PRD';
  end if;

  scope_key := 'product:' || prefix;

  return public.next_entity_code(scope_key, prefix);
end;
$$;

create or replace function public.companies_generate_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or trim(new.code) = '' then
    new.code := public.next_entity_code('company', 'CMP');
  end if;
  return new;
end;
$$;

drop trigger if exists companies_generate_code on public.companies;
create trigger companies_generate_code
before insert on public.companies
for each row execute function public.companies_generate_code();

create or replace function public.suppliers_generate_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or trim(new.code) = '' then
    new.code := public.next_entity_code('supplier', 'SUP');
  end if;
  return new;
end;
$$;

drop trigger if exists suppliers_generate_code on public.suppliers;
create trigger suppliers_generate_code
before insert on public.suppliers
for each row execute function public.suppliers_generate_code();

create or replace function public.profiles_generate_code()
returns trigger
language plpgsql
as $$
begin
  if new.user_code is null or trim(new.user_code) = '' then
    new.user_code := public.next_entity_code('profile', 'USR');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_generate_code on public.profiles;
create trigger profiles_generate_code
before insert on public.profiles
for each row execute function public.profiles_generate_code();

create or replace function public.products_generate_sku()
returns trigger
language plpgsql
as $$
begin
  if new.sku is null or trim(new.sku) = '' then
    new.sku := public.next_product_sku(new.category_id);
  end if;
  return new;
end;
$$;

drop trigger if exists products_generate_sku on public.products;
create trigger products_generate_sku
before insert on public.products
for each row execute function public.products_generate_sku();

create or replace function public.lock_entity_code()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.code is not null and new.code is distinct from old.code then
    new.code := old.code;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_lock_code on public.companies;
create trigger companies_lock_code
before update on public.companies
for each row execute function public.lock_entity_code();

drop trigger if exists suppliers_lock_code on public.suppliers;
create trigger suppliers_lock_code
before update on public.suppliers
for each row execute function public.lock_entity_code();

create or replace function public.lock_product_sku()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.sku is not null and new.sku is distinct from old.sku then
    new.sku := old.sku;
  end if;
  return new;
end;
$$;

drop trigger if exists products_lock_sku on public.products;
create trigger products_lock_sku
before update on public.products
for each row execute function public.lock_product_sku();

create or replace function public.lock_profile_user_code()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.user_code is not null and new.user_code is distinct from old.user_code then
    new.user_code := old.user_code;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_user_code on public.profiles;
create trigger profiles_lock_user_code
before update on public.profiles
for each row execute function public.lock_profile_user_code();

grant execute on function public.next_entity_code(text, text) to authenticated;
grant execute on function public.next_product_sku(uuid) to authenticated;
