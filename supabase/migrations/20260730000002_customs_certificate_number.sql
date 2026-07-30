-- Optional customs certificate number issued when shipment is filed at port.

alter table public.shipments
  add column if not exists customs_certificate_number text;

comment on column public.shipments.customs_certificate_number is
  'رقم الشهادة الجمركية — اختياري، يُسجَّل عند تقديم الشحنة في الميناء';
