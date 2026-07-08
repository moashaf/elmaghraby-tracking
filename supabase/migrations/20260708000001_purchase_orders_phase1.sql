-- Phase 1: Procurement ERP schema (Purchase Orders)

-- =============================
-- Purchase Orders
-- =============================

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references public.suppliers (id),
  company_id uuid not null references public.companies (id),
  order_date date not null default current_date,
  expected_eta date,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'partially_received', 'received', 'over_received', 'cancelled')),
  notes text,
  created_by uuid references public.profiles (id),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index if not exists purchase_orders_company_idx on public.purchase_orders (company_id);
create index if not exists purchase_orders_status_idx on public.purchase_orders (status);
create index if not exists purchase_orders_order_date_idx on public.purchase_orders (order_date desc);

drop trigger if exists set_updated_at on public.purchase_orders;
create trigger set_updated_at before update on public.purchase_orders
for each row execute function public.set_updated_at();

alter table public.purchase_orders enable row level security;
drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders
for select to authenticated using (true);
drop policy if exists purchase_orders_write on public.purchase_orders;
create policy purchase_orders_write on public.purchase_orders
for all to authenticated
  using (public.can_write()) with check (public.can_write());
grant all on table public.purchase_orders to authenticated;
grant all on table public.purchase_orders to service_role;

-- =============================
-- Purchase Order Items
-- =============================

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  order_quantity numeric(12, 2) not null check (order_quantity > 0),
  order_cartons int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, product_id)
);

create index if not exists purchase_order_items_po_idx on public.purchase_order_items (purchase_order_id);
create index if not exists purchase_order_items_product_idx on public.purchase_order_items (product_id);

drop trigger if exists set_updated_at on public.purchase_order_items;
create trigger set_updated_at before update on public.purchase_order_items
for each row execute function public.set_updated_at();

alter table public.purchase_order_items enable row level security;
drop policy if exists purchase_order_items_select on public.purchase_order_items;
create policy purchase_order_items_select on public.purchase_order_items
for select to authenticated using (true);
drop policy if exists purchase_order_items_write on public.purchase_order_items;
create policy purchase_order_items_write on public.purchase_order_items
for all to authenticated
  using (public.can_write()) with check (public.can_write());
grant all on table public.purchase_order_items to authenticated;
grant all on table public.purchase_order_items to service_role;

-- =============================
-- Purchase Order Receipts (line-level)
-- =============================

create table if not exists public.purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  purchase_order_item_id uuid not null references public.purchase_order_items (id) on delete cascade,
  received_date date not null default current_date,
  received_quantity numeric(12, 2) not null check (received_quantity > 0),
  received_cartons int,
  notes text,
  received_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_order_receipts_po_idx on public.purchase_order_receipts (purchase_order_id);
create index if not exists purchase_order_receipts_item_idx on public.purchase_order_receipts (purchase_order_item_id);
create index if not exists purchase_order_receipts_received_date_idx on public.purchase_order_receipts (received_date desc);

drop trigger if exists set_updated_at on public.purchase_order_receipts;
create trigger set_updated_at before update on public.purchase_order_receipts
for each row execute function public.set_updated_at();

alter table public.purchase_order_receipts enable row level security;
drop policy if exists purchase_order_receipts_select on public.purchase_order_receipts;
create policy purchase_order_receipts_select on public.purchase_order_receipts
for select to authenticated using (true);
drop policy if exists purchase_order_receipts_write on public.purchase_order_receipts;
create policy purchase_order_receipts_write on public.purchase_order_receipts
for all to authenticated
  using (public.can_write()) with check (public.can_write());
grant all on table public.purchase_order_receipts to authenticated;
grant all on table public.purchase_order_receipts to service_role;

-- Ensure purchase_order_id matches the referenced purchase_order_item's parent.
create or replace function public.validate_po_receipt_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po_id uuid;
begin
  select purchase_order_id
  into v_po_id
  from public.purchase_order_items
  where id = new.purchase_order_item_id;

  if v_po_id is null then
    raise exception 'purchase_order_item not found: %', new.purchase_order_item_id;
  end if;

  if v_po_id <> new.purchase_order_id then
    raise exception 'purchase_order_id mismatch for receipt item';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_po_receipt_item on public.purchase_order_receipts;
create trigger trg_validate_po_receipt_item
before insert or update on public.purchase_order_receipts
for each row execute function public.validate_po_receipt_item();

-- =============================
-- Shipment Allocations (map receipts into shipment lines)
-- =============================

create table if not exists public.shipment_allocations (
  id uuid primary key default gen_random_uuid(),
  purchase_order_receipt_id uuid not null references public.purchase_order_receipts (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  shipment_product_id uuid not null references public.shipment_products (id) on delete cascade,
  allocated_quantity numeric(12, 2) not null check (allocated_quantity > 0),
  allocated_cartons int,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_receipt_id, shipment_product_id)
);

create index if not exists shipment_allocations_shipment_idx on public.shipment_allocations (shipment_id);
create index if not exists shipment_allocations_receipt_idx on public.shipment_allocations (purchase_order_receipt_id);
create index if not exists shipment_allocations_shipment_product_idx on public.shipment_allocations (shipment_product_id);

drop trigger if exists set_updated_at on public.shipment_allocations;
create trigger set_updated_at before update on public.shipment_allocations
for each row execute function public.set_updated_at();

alter table public.shipment_allocations enable row level security;
drop policy if exists shipment_allocations_select on public.shipment_allocations;
create policy shipment_allocations_select on public.shipment_allocations
for select to authenticated using (true);
drop policy if exists shipment_allocations_write on public.shipment_allocations;
create policy shipment_allocations_write on public.shipment_allocations
for all to authenticated
  using (public.can_write()) with check (public.can_write());
grant all on table public.shipment_allocations to authenticated;
grant all on table public.shipment_allocations to service_role;

-- Validate shipment_product belongs to shipment_id and product matches the PO item of the receipt.
create or replace function public.validate_shipment_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment_id uuid;
  v_shipment_product_product_id uuid;
  v_receipt_product_id uuid;
  v_received_quantity numeric(12, 2);
  v_allocated_sum numeric(12, 2);
begin
  select shipment_id, product_id
  into v_shipment_id, v_shipment_product_product_id
  from public.shipment_products
  where id = new.shipment_product_id;

  if v_shipment_id is null then
    raise exception 'shipment_product not found: %', new.shipment_product_id;
  end if;

  if v_shipment_id <> new.shipment_id then
    raise exception 'shipment_id mismatch for shipment_product_id';
  end if;

  select poi.product_id, r.received_quantity
  into v_receipt_product_id, v_received_quantity
  from public.purchase_order_receipts r
  join public.purchase_order_items poi on poi.id = r.purchase_order_item_id
  where r.id = new.purchase_order_receipt_id;

  if v_receipt_product_id is null then
    raise exception 'purchase_order_receipt not found: %', new.purchase_order_receipt_id;
  end if;

  if v_shipment_product_product_id <> v_receipt_product_id then
    raise exception 'product mismatch between shipment line and PO receipt';
  end if;

  -- Prevent over-allocation: sum(allocations) for a receipt <= received_quantity.
  select coalesce(sum(sa.allocated_quantity), 0)
  into v_allocated_sum
  from public.shipment_allocations sa
  where sa.purchase_order_receipt_id = new.purchase_order_receipt_id
    and sa.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_allocated_sum + new.allocated_quantity > v_received_quantity then
    raise exception 'allocated_quantity exceeds received_quantity for receipt %', new.purchase_order_receipt_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_shipment_allocation on public.shipment_allocations;
create trigger trg_validate_shipment_allocation
before insert or update on public.shipment_allocations
for each row execute function public.validate_shipment_allocation();

-- =============================
-- Purchase Order Status Recompute (based on receipts)
-- =============================

create or replace function public.recompute_purchase_order_status(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_items int;
  v_over_items int;
  v_all_received boolean;
  v_has_any_receipts boolean;
begin
  select count(*) into v_total_items
  from public.purchase_order_items
  where purchase_order_id = p_purchase_order_id;

  select exists (
    select 1 from public.purchase_order_receipts r
    where r.purchase_order_id = p_purchase_order_id
  ) into v_has_any_receipts;

  select count(*) into v_over_items
  from public.purchase_order_items i
  where i.purchase_order_id = p_purchase_order_id
    and coalesce((
      select sum(r.received_quantity)
      from public.purchase_order_receipts r
      where r.purchase_order_item_id = i.id
    ), 0) > i.order_quantity;

  select not exists (
    select 1
    from public.purchase_order_items i
    where i.purchase_order_id = p_purchase_order_id
      and coalesce((
        select sum(r.received_quantity)
        from public.purchase_order_receipts r
        where r.purchase_order_item_id = i.id
      ), 0) < i.order_quantity
  ) into v_all_received;

  update public.purchase_orders
  set
    status = case
      when v_total_items = 0 then status
      when v_over_items > 0 then 'over_received'
      when v_all_received and v_has_any_receipts then 'received'
      when v_has_any_receipts then 'partially_received'
      else status
    end,
    received_at = case
      when v_over_items > 0 or (v_all_received and v_has_any_receipts) then coalesce(received_at, now())
      else received_at
    end,
    updated_at = now()
  where id = p_purchase_order_id
    and status <> 'cancelled';
end;
$$;

create or replace function public.trg_purchase_order_receipts_recompute_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_purchase_order_status(old.purchase_order_id);
  else
    perform public.recompute_purchase_order_status(new.purchase_order_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_purchase_order_receipts_recompute_status on public.purchase_order_receipts;
create trigger trg_purchase_order_receipts_recompute_status
after insert or update or delete on public.purchase_order_receipts
for each row execute function public.trg_purchase_order_receipts_recompute_status();

create or replace function public.trg_purchase_order_items_recompute_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_purchase_order_status(old.purchase_order_id);
  else
    perform public.recompute_purchase_order_status(new.purchase_order_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_purchase_order_items_recompute_status on public.purchase_order_items;
create trigger trg_purchase_order_items_recompute_status
after insert or update or delete on public.purchase_order_items
for each row execute function public.trg_purchase_order_items_recompute_status();

