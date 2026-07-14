-- Restrict supplier role from reading staff operational tables.
-- Purchase-order policies already scope suppliers to their own POs.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'manager', 'viewer'), false);
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies',
    'shipments',
    'shipment_containers',
    'shipment_products',
    'container_files',
    'shipment_costs',
    'shipment_documents',
    'shipment_timeline_events',
    'audit_log',
    'shipping_routes'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.is_staff());',
      t, t
    );
  end loop;
end;
$$;

-- Suppliers may read only their linked supplier row; staff read all.
drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
for select to authenticated using (
  public.is_staff()
  or (public.is_supplier() and id = public.current_supplier_id())
);

-- Product catalog is needed for PO line items / confirm UI.
drop policy if exists products_select on public.products;
create policy products_select on public.products
for select to authenticated using (
  public.is_staff()
  or public.is_supplier()
);

drop policy if exists product_categories_select on public.product_categories;
create policy product_categories_select on public.product_categories
for select to authenticated using (
  public.is_staff()
  or public.is_supplier()
);

-- app_settings: staff only (system knobs).
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
for select to authenticated using (public.is_staff());
