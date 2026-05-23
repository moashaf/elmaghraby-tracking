-- Elmaghraby Tracing — initial schema
-- Run via Supabase CLI or SQL editor

-- Extensions
create extension if not exists "pg_trgm";

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'manager', 'viewer')),
  locale text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reference data
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text,
  code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  country text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Products: NO supplier_id
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name_ar text not null,
  name_en text,
  category text,
  unit text not null default 'piece',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_name_ar_trgm on public.products using gin (name_ar gin_trgm_ops);

-- Shipments: 3 statuses + closed
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_number text not null unique,
  acid text not null,
  company_id uuid not null references public.companies (id),
  supplier_id uuid not null references public.suppliers (id),
  shipping_port text not null,
  arrival_port text not null,
  shipped_at date not null,
  eta date not null,
  shipping_duration_days int,
  shipment_type text not null default 'FCL' check (shipment_type in ('FCL', 'LCL')),
  route text,
  status text not null default 'in_sea' check (status in ('in_sea', 'customs', 'closed')),
  previous_status text check (previous_status is null or previous_status in ('in_sea', 'customs')),
  delay_reason text,
  delayed_at timestamptz,
  auto_moved_to_customs_at timestamptz,
  entry_completed_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shipments_status_idx on public.shipments (status);
create index if not exists shipments_eta_idx on public.shipments (eta);
create index if not exists shipments_company_idx on public.shipments (company_id);
create index if not exists shipments_supplier_idx on public.shipments (supplier_id);

-- Shipment number sequence per year
create table if not exists public.shipment_number_sequences (
  year int primary key,
  last_value int not null default 0
);

create table if not exists public.shipment_containers (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  container_number text not null,
  weight_kg numeric(12, 2),
  cartons_count int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shipment_id, container_number)
);

create table if not exists public.shipment_products (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric(12, 2) not null check (quantity > 0),
  cartons_count int,
  notes text,
  is_new_incoming_product boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shipment_id, product_id)
);

create table if not exists public.container_files (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.shipment_containers (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.shipment_costs (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null unique references public.shipments (id) on delete cascade,
  customs_cost numeric(14, 2) not null default 0,
  shipping_cost numeric(14, 2) not null default 0,
  clearance_cost numeric(14, 2) not null default 0,
  local_transport_cost numeric(14, 2) not null default 0,
  other_expenses numeric(14, 2) not null default 0,
  total_cost numeric(14, 2) generated always as (
    customs_cost + shipping_cost + clearance_cost + local_transport_cost + other_expenses
  ) stored,
  closing_notes text,
  closed_by uuid references public.profiles (id),
  closed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipment_documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  doc_type text not null default 'other',
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.shipment_timeline_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  event_type text not null,
  title_ar text not null,
  description_ar text,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'companies', 'suppliers', 'products', 'shipments',
    'shipment_containers', 'shipment_products', 'shipment_costs'
  ]
  loop
    execute format('
      drop trigger if exists set_updated_at on public.%I;
      create trigger set_updated_at before update on public.%I
      for each row execute function public.set_updated_at();
    ', t, t);
  end loop;
end;
$$;

-- Shipment number generation
create or replace function public.generate_shipment_number()
returns trigger
language plpgsql
as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  if new.shipment_number is not null and new.shipment_number <> '' then
    return new;
  end if;
  insert into public.shipment_number_sequences (year, last_value)
  values (y, 1)
  on conflict (year) do update set last_value = public.shipment_number_sequences.last_value + 1
  returning last_value into n;
  new.shipment_number := 'SH-' || y::text || '-' || lpad(n::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_generate_shipment_number on public.shipments;
create trigger trg_generate_shipment_number
before insert on public.shipments
for each row execute function public.generate_shipment_number();

-- Timeline on status change
create or replace function public.log_shipment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.shipment_timeline_events (shipment_id, event_type, title_ar, description_ar, metadata, created_by)
    values (
      new.id,
      'status_change',
      'تغيير الحالة',
      'من ' || old.status || ' إلى ' || new.status,
      jsonb_build_object('from', old.status, 'to', new.status),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shipment_status_timeline on public.shipments;
create trigger trg_shipment_status_timeline
after update on public.shipments
for each row execute function public.log_shipment_status_change();

-- Auto move to customs (callable from cron or app)
create or replace function public.auto_move_shipments_to_customs()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.shipments s
  set
    status = 'customs',
    auto_moved_to_customs_at = now(),
    updated_at = now()
  where s.status = 'in_sea'
    and (
      current_date >= s.eta
      or (
        s.shipping_duration_days is not null
        and current_date >= s.shipped_at + (s.shipping_duration_days || ' days')::interval
      )
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'viewer');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_containers enable row level security;
alter table public.shipment_products enable row level security;
alter table public.container_files enable row level security;
alter table public.shipment_costs enable row level security;
alter table public.shipment_documents enable row level security;
alter table public.shipment_timeline_events enable row level security;
alter table public.audit_log enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'manager'), false);
$$;

-- Authenticated read all
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'suppliers', 'products', 'shipments', 'shipment_containers',
    'shipment_products', 'container_files', 'shipment_costs', 'shipment_documents',
    'shipment_timeline_events', 'audit_log', 'profiles'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (true);',
      t, t
    );
  end loop;
end;
$$;

-- Write policies (admin/manager)
create policy companies_write on public.companies for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy suppliers_write on public.suppliers for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy products_write on public.products for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy shipments_write on public.shipments for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy shipment_containers_write on public.shipment_containers for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy shipment_products_write on public.shipment_products for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy container_files_write on public.container_files for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy shipment_costs_write on public.shipment_costs for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy shipment_documents_write on public.shipment_documents for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy shipment_timeline_events_write on public.shipment_timeline_events for insert to authenticated
  with check (public.can_write());
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (public.can_write());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() or public.current_user_role() = 'admin');

-- Storage bucket (run in dashboard or storage migration)
-- insert into storage.buckets (id, name, public) values ('container-files', 'container-files', false);

-- Realtime
alter publication supabase_realtime add table public.shipments;
alter publication supabase_realtime add table public.shipment_containers;
alter publication supabase_realtime add table public.shipment_products;
alter publication supabase_realtime add table public.container_files;
alter publication supabase_realtime add table public.shipment_timeline_events;
