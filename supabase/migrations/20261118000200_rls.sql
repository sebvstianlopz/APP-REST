-- =========================================================================
-- Row-level security & column privileges
-- =========================================================================

alter table public.profiles       enable row level security;
alter table public.municipalities enable row level security;
alter table public.dishes         enable row level security;
alter table public.restaurants    enable row level security;
alter table public.menu_items     enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.search_events  enable row level security;

-- Is the current user the owner of this restaurant? (security definer so menu
-- policies can see unlisted restaurants owned by the caller)
create or replace function public.owns_restaurant(p_restaurant_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.restaurants where id = p_restaurant_id and owner_id = auth.uid())
$$;

create or replace function public.restaurant_is_listed(p_restaurant_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select is_listed from public.restaurants where id = p_restaurant_id), false)
$$;

-- ---------------- profiles ----------------
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Users can edit their name/locale but never their role.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

-- ---------------- reference data ----------------
create policy municipalities_read on public.municipalities for select using (true);
create policy dishes_read on public.dishes for select using (true);
create policy dishes_admin_write on public.dishes for all
  using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.municipalities from anon, authenticated;

-- ---------------- restaurants ----------------
create policy restaurants_read on public.restaurants for select
  using (is_listed or owner_id = auth.uid() or public.is_admin());
create policy restaurants_insert on public.restaurants for insert to authenticated
  with check (owner_id = auth.uid() or public.is_admin());
create policy restaurants_update on public.restaurants for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy restaurants_delete on public.restaurants for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.restaurants from anon;

-- ---------------- menu items ----------------
create policy menu_items_read on public.menu_items for select
  using (public.restaurant_is_listed(restaurant_id) or public.owns_restaurant(restaurant_id) or public.is_admin());
create policy menu_items_write on public.menu_items for all to authenticated
  using (public.owns_restaurant(restaurant_id) or public.is_admin())
  with check (public.owns_restaurant(restaurant_id) or public.is_admin());

revoke insert, update, delete on public.menu_items from anon;

-- ---------------- subscriptions (read-only for owners) ----------------
create policy subscriptions_read on public.subscriptions for select
  using (public.owns_restaurant(restaurant_id) or public.is_admin());
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- ---------------- search events (service role writes; admins read) ----------------
create policy search_events_admin_read on public.search_events for select using (public.is_admin());
revoke insert, update, delete on public.search_events from anon, authenticated;
