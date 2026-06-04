-- Flag shipment line items as disassembled (مفكك).
alter table public.shipment_products
  add column if not exists is_disassembled boolean not null default false;
