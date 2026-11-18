-- =========================================================================
-- APP-REST core schema: restaurants, menus, dish dictionary, memberships
-- =========================================================================

create extension if not exists postgis  with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- -------------------------------------------------------------------------
-- Text normalization used by search: lowercase, strip accents, keep only
-- [a-z0-9] words separated by single spaces.  "Alcapurrías (2)" -> "alcapurrias 2"
-- -------------------------------------------------------------------------
create or replace function public.normalize_text(t text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
           lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))),
           '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function public.normalize_terms(name_es text, name_en text, aliases text[])
returns text[]
language sql immutable parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(distinct n) filter (where n <> ''), '{}')
  from (
    select public.normalize_text(x) as n
    from unnest(array[name_es, name_en] || coalesce(aliases, '{}')) as x
  ) s
$$;

-- -------------------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------------------
create type public.user_role as enum ('diner', 'owner', 'admin');
create type public.restaurant_status as enum ('draft', 'pending_review', 'active', 'suspended');
create type public.pr_region as enum ('metro', 'norte', 'sur', 'este', 'oeste', 'centro');

-- -------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null default 'diner',
  full_name  text,
  locale     text not null default 'es' check (locale in ('es', 'en')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, locale)
  values (
    new.id,
    -- Self sign-up can only ever produce 'diner' or 'owner'; admins are promoted manually.
    case when new.raw_user_meta_data ->> 'role' = 'owner' then 'owner'::public.user_role
         else 'diner'::public.user_role end,
    new.raw_user_meta_data ->> 'full_name',
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'es' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- -------------------------------------------------------------------------
-- Geography & dish dictionary
-- -------------------------------------------------------------------------
create table public.municipalities (
  id       smallint primary key,
  slug     text not null unique,
  name     text not null,
  region   public.pr_region not null,
  centroid extensions.geography(Point, 4326) not null
);

create table public.dishes (
  id           serial primary key,
  slug         text not null unique,
  name_es      text not null,
  name_en      text not null,
  aliases      text[] not null default '{}',
  category     text,
  search_terms text[] generated always as (public.normalize_terms(name_es, name_en, aliases)) stored
);
create index dishes_search_terms_idx on public.dishes using gin (search_terms);

-- -------------------------------------------------------------------------
-- Restaurants
-- -------------------------------------------------------------------------
create table public.restaurants (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid references public.profiles (id) on delete set null,
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null check (char_length(name) between 2 and 120),
  description_es   text,
  description_en   text,
  address          text,
  municipality_id  smallint references public.municipalities (id),
  location         extensions.geography(Point, 4326),
  phone            text,
  website          text,
  hours            jsonb not null default '{}'::jsonb,
  price_range      smallint check (price_range between 1 and 4),
  cuisine_tags     text[] not null default '{}',
  cover_photo_path text,
  status           public.restaurant_status not null default 'draft',
  -- Derived: visible to the public only when approved AND membership is paid.
  -- Maintained by triggers below; never written directly by clients.
  is_listed        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index restaurants_owner_idx        on public.restaurants (owner_id);
create index restaurants_municipality_idx on public.restaurants (municipality_id) where is_listed;
create index restaurants_location_idx     on public.restaurants using gist (location);

-- -------------------------------------------------------------------------
-- Menu items
-- -------------------------------------------------------------------------
create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 160),
  description   text,
  price         numeric(8, 2) check (price >= 0),
  category      text,
  position      integer not null default 0,
  is_available  boolean not null default true,
  dish_id       integer references public.dishes (id) on delete set null,
  search_text   text generated always as (public.normalize_text(name || ' ' || coalesce(description, ''))) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index menu_items_restaurant_idx on public.menu_items (restaurant_id, position);
create index menu_items_dish_idx       on public.menu_items (dish_id);
create index menu_items_search_trgm    on public.menu_items using gin (search_text extensions.gin_trgm_ops);

-- -------------------------------------------------------------------------
-- Memberships (mirrors Stripe; written only by the webhook via service role)
-- -------------------------------------------------------------------------
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  restaurant_id          uuid not null unique references public.restaurants (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  price_id               text,
  status                 text not null,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- Statuses that keep a restaurant visible. past_due = Stripe is still retrying
-- the card, so we give a grace period; Stripe moves it to unpaid/canceled after.
create or replace function public.membership_is_active(p_status text)
returns boolean
language sql immutable
set search_path = ''
as $$ select p_status in ('active', 'trialing', 'past_due') $$;

-- -------------------------------------------------------------------------
-- Search analytics (written server-side with the service role)
-- -------------------------------------------------------------------------
create table public.search_events (
  id              bigserial primary key,
  terms           text[] not null,
  municipality_id smallint references public.municipalities (id),
  result_count    integer not null,
  created_at      timestamptz not null default now()
);

-- =========================================================================
-- Triggers
-- =========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

create trigger restaurants_touch before update on public.restaurants
  for each row execute function public.touch_updated_at();
create trigger menu_items_touch before update on public.menu_items
  for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Guard restaurant writes made by end users and recompute is_listed.
create or replace function public.restaurants_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  privileged boolean := current_user not in ('anon', 'authenticated') or public.is_admin();
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

create trigger restaurants_guard before insert or update on public.restaurants
  for each row execute function public.restaurants_guard();

-- When a membership changes, recompute the listing flag on its restaurant.
create or replace function public.subscriptions_sync_listing()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.restaurants r
     set is_listed = r.status = 'active' and exists (
           select 1 from public.subscriptions s
           where s.restaurant_id = r.id and public.membership_is_active(s.status))
   where r.id = coalesce(new.restaurant_id, old.restaurant_id);
  return null;
end;
$$;

create trigger subscriptions_sync_listing after insert or update or delete on public.subscriptions
  for each row execute function public.subscriptions_sync_listing();
