-- Phase 2: Supplier role, profiles.supplier_id, PO number generation, timeline, supplier RLS

-- =============================
-- Profiles: supplier role + supplier_id
-- =============================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'viewer', 'supplier'));

alter table public.profiles
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;

create index if not exists profiles_supplier_idx on public.profiles (supplier_id);

alter table public.profiles drop constraint if exists profiles_supplier_required;
alter table public.profiles
  add constraint profiles_supplier_required
  check (role <> 'supplier' or supplier_id is not null);

-- =============================
-- Helper functions
-- =============================

create or replace function public.is_supplier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'supplier', false);
$$;

create or replace function public.current_supplier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select supplier_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_read_purchase_orders()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in ('admin', 'manager', 'viewer', 'supplier'),
    false
  );
$$;

-- =============================
-- PO number generation
-- =============================

create table if not exists public.purchase_order_number_sequences (
  year int primary key,
  last_value int not null default 0
);

create or replace function public.generate_po_number()
returns trigger
language plpgsql
as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  if new.po_number is not null and new.po_number <> '' then
    return new;
  end if;
  insert into public.purchase_order_number_sequences (year, last_value)
  values (y, 1)
  on conflict (year) do update
    set last_value = public.purchase_order_number_sequences.last_value + 1
  returning last_value into n;
  new.po_number := 'PO-' || y::text || '-' || lpad(n::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_generate_po_number on public.purchase_orders;
create trigger trg_generate_po_number
before insert on public.purchase_orders
for each row execute function public.generate_po_number();

-- =============================
-- PO timeline events
-- =============================

create table if not exists public.purchase_order_timeline_events (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  event_type text not null,
  title_ar text not null,
  description_ar text,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists po_timeline_po_idx
  on public.purchase_order_timeline_events (purchase_order_id, created_at desc);

alter table public.purchase_order_timeline_events enable row level security;

drop policy if exists purchase_order_timeline_events_select on public.purchase_order_timeline_events;
create policy purchase_order_timeline_events_select on public.purchase_order_timeline_events
for select to authenticated using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_id
      and (
        public.current_user_role() in ('admin', 'manager', 'viewer')
        or (public.is_supplier() and po.supplier_id = public.current_supplier_id())
      )
  )
);

drop policy if exists purchase_order_timeline_events_write on public.purchase_order_timeline_events;
create policy purchase_order_timeline_events_write on public.purchase_order_timeline_events
for all to authenticated
  using (public.can_write()) with check (public.can_write());

grant all on table public.purchase_order_timeline_events to authenticated;
grant all on table public.purchase_order_timeline_events to service_role;

create or replace function public.log_purchase_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.purchase_order_timeline_events (
      purchase_order_id, event_type, title_ar, description_ar, metadata, created_by
    )
    values (
      new.id,
      'status_change',
      'تغيير حالة أمر الشراء',
      'من ' || old.status || ' إلى ' || new.status,
      jsonb_build_object('from', old.status, 'to', new.status),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_po_status_timeline on public.purchase_orders;
create trigger trg_po_status_timeline
after update on public.purchase_orders
for each row execute function public.log_purchase_order_status_change();

-- =============================
-- Supplier-scoped RLS (replace broad policies)
-- =============================

drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders
for select to authenticated using (
  public.current_user_role() in ('admin', 'manager', 'viewer')
  or (public.is_supplier() and supplier_id = public.current_supplier_id())
);

drop policy if exists purchase_orders_write on public.purchase_orders;
create policy purchase_orders_staff_write on public.purchase_orders
for all to authenticated
  using (public.can_write()) with check (public.can_write());

drop policy if exists purchase_orders_supplier_update on public.purchase_orders;
create policy purchase_orders_supplier_update on public.purchase_orders
for update to authenticated
  using (public.is_supplier() and supplier_id = public.current_supplier_id())
  with check (public.is_supplier() and supplier_id = public.current_supplier_id());

drop policy if exists purchase_order_items_select on public.purchase_order_items;
create policy purchase_order_items_select on public.purchase_order_items
for select to authenticated using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_id
      and (
        public.current_user_role() in ('admin', 'manager', 'viewer')
        or (public.is_supplier() and po.supplier_id = public.current_supplier_id())
      )
  )
);

drop policy if exists purchase_order_items_write on public.purchase_order_items;
create policy purchase_order_items_write on public.purchase_order_items
for all to authenticated
  using (public.can_write()) with check (public.can_write());

drop policy if exists purchase_order_receipts_select on public.purchase_order_receipts;
create policy purchase_order_receipts_select on public.purchase_order_receipts
for select to authenticated using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_id
      and (
        public.current_user_role() in ('admin', 'manager', 'viewer')
        or (public.is_supplier() and po.supplier_id = public.current_supplier_id())
      )
  )
);

drop policy if exists purchase_order_receipts_write on public.purchase_order_receipts;
create policy purchase_order_receipts_write on public.purchase_order_receipts
for all to authenticated
  using (public.can_write()) with check (public.can_write());

drop policy if exists shipment_allocations_select on public.shipment_allocations;
create policy shipment_allocations_select on public.shipment_allocations
for select to authenticated using (public.current_user_role() in ('admin', 'manager', 'viewer'));

drop policy if exists shipment_allocations_write on public.shipment_allocations;
create policy shipment_allocations_write on public.shipment_allocations
for all to authenticated
  using (public.can_write()) with check (public.can_write());
