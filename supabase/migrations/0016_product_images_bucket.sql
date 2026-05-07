-- =========================
-- product-images storage bucket
-- =========================
-- Public bucket used by the admin image-triage tool
-- (/admin/image-triage). Admin uploads product photos; the bucket
-- serves them back as public URLs written to products.image_url.
--
-- Write path uses the service-role client (bypasses RLS) from the
-- /api/admin/image-triage/apply route; read path is public so
-- unauthenticated product browsers and email templates can see
-- images too.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760, -- 10 MB cap per image
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read — anyone can fetch the image URL (needed for the public
-- catalog rendering and email assets).
drop policy if exists "product-images public read" on storage.objects;
create policy "product-images public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Admin-only write, update, delete via the API (which uses the
-- service role, but leaving an explicit admin policy documents intent
-- and lets admins manage directly through the Supabase Dashboard).
drop policy if exists "product-images admin write" on storage.objects;
create policy "product-images admin write"
  on storage.objects for all
  using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());
