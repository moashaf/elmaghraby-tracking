-- Optional product image stored in Supabase Storage (bucket: product-images)

alter table public.products
  add column if not exists image_url text;

comment on column public.products.image_url is 'Storage path in product-images bucket';

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

create policy "product_images_authenticated_read"
on storage.objects for select to authenticated
using (bucket_id = 'product-images');

create policy "product_images_authenticated_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images');

create policy "product_images_authenticated_update"
on storage.objects for update to authenticated
using (bucket_id = 'product-images');

create policy "product_images_authenticated_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');
