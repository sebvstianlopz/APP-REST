-- =========================================================================
-- RPCs used by the web app
-- =========================================================================

-- Full public profile of a restaurant with its menu, in one round-trip.
-- SECURITY INVOKER: RLS decides visibility, so owners/admins can preview
-- unlisted restaurants while the public only sees listed ones.
create or replace function public.get_restaurant(p_slug text)
returns jsonb
language sql stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'slug', r.slug,
    'name', r.name,
    'description_es', r.description_es,
    'description_en', r.description_en,
    'address', r.address,
    'phone', r.phone,
    'website', r.website,
    'hours', r.hours,
    'price_range', r.price_range,
    'cuisine_tags', r.cuisine_tags,
    'cover_photo_path', r.cover_photo_path,
    'status', r.status,
    'is_listed', r.is_listed,
    'lat', extensions.st_y(r.location::extensions.geometry),
    'lng', extensions.st_x(r.location::extensions.geometry),
    'municipality', case when m.id is null then null else
      jsonb_build_object('id', m.id, 'slug', m.slug, 'name', m.name, 'region', m.region) end,
    'menu', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', mi.id, 'name', mi.name, 'description', mi.description, 'price', mi.price,
               'category', mi.category, 'is_available', mi.is_available, 'dish_id', mi.dish_id)
             order by mi.category nulls last, mi.position, mi.name)
      from public.menu_items mi
      where mi.restaurant_id = r.id and mi.is_available
    ), '[]'::jsonb)
  )
  from public.restaurants r
  left join public.municipalities m on m.id = r.municipality_id
  where r.slug = p_slug
$$;

grant execute on function public.get_restaurant to anon, authenticated;

-- Listed restaurant slugs for the sitemap.
create or replace function public.listed_restaurant_slugs()
returns table (slug text, updated_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select slug, updated_at from public.restaurants where is_listed order by slug $$;

grant execute on function public.listed_restaurant_slugs to anon, authenticated;

-- A diner who signs up later as a restaurant owner.
create or replace function public.become_owner()
returns void
language sql security definer set search_path = ''
as $$ update public.profiles set role = 'owner' where id = auth.uid() and role = 'diner' $$;

revoke execute on function public.become_owner from anon, public;
grant execute on function public.become_owner to authenticated;

-- Computed columns so the REST API can expose coordinates: select=lat,lng
create or replace function public.lat(r public.restaurants)
returns double precision language sql stable set search_path = ''
as $$ select extensions.st_y(r.location::extensions.geometry) $$;

create or replace function public.lng(r public.restaurants)
returns double precision language sql stable set search_path = ''
as $$ select extensions.st_x(r.location::extensions.geometry) $$;

-- Best dictionary dish for a menu item name: the longest dish name/alias that
-- appears as whole word(s) in it ("Mofongo de camarones" -> mofongo-de-mariscos
-- via its alias, rather than plain mofongo).
create or replace function public.match_dish(p_text text)
returns integer
language sql stable
set search_path = ''
as $$
  select d.id
  from public.dishes d, unnest(d.search_terms) s
  where public.normalize_text(p_text) ~ ('\m' || s || '(s|es)?\M')
  order by char_length(s) desc, d.id
  limit 1
$$;

-- Tag every untagged item of a restaurant. SECURITY INVOKER: RLS limits it to
-- restaurants the caller owns.
create or replace function public.auto_tag_menu(p_restaurant_id uuid)
returns integer
language sql volatile
security invoker
set search_path = ''
as $$
  with updated as (
    update public.menu_items
       set dish_id = public.match_dish(name)
     where restaurant_id = p_restaurant_id
       and dish_id is null
       and public.match_dish(name) is not null
    returning 1
  )
  select count(*)::int from updated
$$;

revoke execute on function public.auto_tag_menu from anon, public;
grant execute on function public.auto_tag_menu to authenticated;
