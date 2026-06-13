-- Fix product image uploads: ensure bucket + storage.objects RLS for authenticated users.
-- Run in Supabase SQL Editor if uploads fail with "row-level security policy".

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

drop policy if exists "product_images_authenticated_read" on storage.objects;
drop policy if exists "product_images_authenticated_insert" on storage.objects;
drop policy if exists "product_images_authenticated_update" on storage.objects;
drop policy if exists "product_images_authenticated_delete" on storage.objects;

create policy "product_images_authenticated_read"
on storage.objects for select to authenticated
using (bucket_id = 'product-images');

create policy "product_images_authenticated_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images');

create policy "product_images_authenticated_update"
on storage.objects for update to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

create policy "product_images_authenticated_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');
