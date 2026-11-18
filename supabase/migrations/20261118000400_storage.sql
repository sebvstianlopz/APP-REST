-- =========================================================================
-- Storage: public bucket for restaurant cover and menu photos.
-- Objects live at  <restaurant_id>/<filename>  and only that restaurant's
-- owner (or an admin) may write there.
-- (Requires Supabase's storage schema; skipped by the local test harness.)
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('restaurant-photos', 'restaurant-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "restaurant photos are public"
  on storage.objects for select
  using (bucket_id = 'restaurant-photos');

create policy "owners upload their restaurant photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'restaurant-photos'
    and (public.owns_restaurant(((storage.foldername(name))[1])::uuid) or public.is_admin())
  );

create policy "owners update their restaurant photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'restaurant-photos'
    and (public.owns_restaurant(((storage.foldername(name))[1])::uuid) or public.is_admin())
  );

create policy "owners delete their restaurant photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'restaurant-photos'
    and (public.owns_restaurant(((storage.foldername(name))[1])::uuid) or public.is_admin())
  );
