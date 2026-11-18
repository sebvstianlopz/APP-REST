-- =========================================================================
-- Fixes for Supabase database advisor findings
-- =========================================================================

-- -------------------------------------------------------------------------
-- Security: SECURITY DEFINER helpers must not be callable via /rest/v1/rpc.
-- -------------------------------------------------------------------------

-- Trigger functions: EXECUTE is only checked when the trigger is created, so
-- revoking it doesn't stop the triggers from firing.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.subscriptions_sync_listing() from public, anon, authenticated;

-- RLS helpers: policies run them as the calling role, so anon/authenticated
-- need EXECUTE. Move them to a schema the API doesn't expose instead.
-- (Policies reference functions by OID, so they keep working after the move.)
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

alter function public.is_admin() set schema private;
alter function public.owns_restaurant(uuid) set schema private;
alter function public.restaurant_is_listed(uuid) set schema private;

grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.owns_restaurant(uuid) to anon, authenticated, service_role;
grant execute on function private.restaurant_is_listed(uuid) to anon, authenticated, service_role;

-- Function bodies refer to helpers by name, so update the one that calls is_admin().
create or replace function public.restaurants_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  privileged boolean := current_user not in ('anon', 'authenticated') or private.is_admin();
begin
  if not privileged then
    if tg_op = 'INSERT' then
      new.status := 'draft';
    else
      new.owner_id := old.owner_id;
      -- Owners may only submit a draft for review (or pull it back to draft).
      if new.status is distinct from old.status
         and not (old.status = 'draft' and new.status = 'pending_review')
         and not (old.status = 'pending_review' and new.status = 'draft') then
        raise exception 'Only an administrator can change status from % to %', old.status, new.status
          using errcode = '42501';
      end if;
    end if;
  end if;

  new.is_listed := new.status = 'active' and exists (
    select 1 from public.subscriptions s
    where s.restaurant_id = new.id and public.membership_is_active(s.status)
  );
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- Performance: evaluate auth.uid() once per query, not once per row.
-- -------------------------------------------------------------------------
drop policy profiles_select on public.profiles;
drop policy profiles_update on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()) or private.is_admin());
create policy profiles_update on public.profiles for update
  using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

drop policy restaurants_read on public.restaurants;
drop policy restaurants_insert on public.restaurants;
drop policy restaurants_update on public.restaurants;
drop policy restaurants_delete on public.restaurants;
create policy restaurants_read on public.restaurants for select
  using (is_listed or owner_id = (select auth.uid()) or private.is_admin());
create policy restaurants_insert on public.restaurants for insert to authenticated
  with check (owner_id = (select auth.uid()) or private.is_admin());
create policy restaurants_update on public.restaurants for update to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin())
  with check (owner_id = (select auth.uid()) or private.is_admin());
create policy restaurants_delete on public.restaurants for delete to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin());

-- -------------------------------------------------------------------------
-- Performance: one permissive policy per role+action (split "for all").
-- -------------------------------------------------------------------------
drop policy dishes_admin_write on public.dishes;
create policy dishes_admin_insert on public.dishes for insert to authenticated
  with check (private.is_admin());
create policy dishes_admin_update on public.dishes for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy dishes_admin_delete on public.dishes for delete to authenticated
  using (private.is_admin());

drop policy menu_items_write on public.menu_items;
create policy menu_items_insert on public.menu_items for insert to authenticated
  with check (private.owns_restaurant(restaurant_id) or private.is_admin());
create policy menu_items_update on public.menu_items for update to authenticated
  using (private.owns_restaurant(restaurant_id) or private.is_admin())
  with check (private.owns_restaurant(restaurant_id) or private.is_admin());
create policy menu_items_delete on public.menu_items for delete to authenticated
  using (private.owns_restaurant(restaurant_id) or private.is_admin());

-- -------------------------------------------------------------------------
-- Performance: cover the search_events foreign key.
-- -------------------------------------------------------------------------
create index if not exists search_events_municipality_idx on public.search_events (municipality_id);
