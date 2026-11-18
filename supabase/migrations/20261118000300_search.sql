-- =========================================================================
-- Multi-dish search
--
-- Given the dishes a diner wants (e.g. {'mofongo','alcapurrias'}), return
-- every LISTED restaurant serving at least one of them, ranked by:
--   1. how many of the requested dishes it covers (desc)
--   2. distance from the diner, when a location is given (asc)
--   3. name
--
-- A menu item matches a requested term when any of the following holds:
--   * it is tagged (dish_id) with a dictionary dish the term resolves to
--   * one of the term's patterns (the term itself + aliases of the dishes it
--     resolves to, in ES and EN) appears as whole word(s) in the item's
--     name/description, allowing a plural ending (alcapurria -> alcapurrias)
--   * typos ("mofngo") resolve to the closest dictionary dish; a term that
--     matches no dish at all may also fuzzy-match whole words in the item
-- =========================================================================

create or replace function public.search_restaurants(
  terms            text[],
  lat              double precision default null,
  lng              double precision default null,
  radius_km        double precision default null,
  p_municipality_id smallint default null,
  p_region         public.pr_region default null,
  p_restaurant_id  uuid default null,
  max_results      integer default 50
)
returns table (
  restaurant_id    uuid,
  slug             text,
  name             text,
  municipality     text,
  region           public.pr_region,
  address          text,
  price_range      smallint,
  cuisine_tags     text[],
  cover_photo_path text,
  lat              double precision,
  lng              double precision,
  distance_km      double precision,
  requested_count  integer,
  match_count      integer,
  matched_terms    text[],
  matched_items    jsonb
)
language sql stable
security invoker
set search_path = ''
as $$
  with input as (
    select distinct on (public.normalize_text(t)) btrim(t) as term, public.normalize_text(t) as norm
    from unnest(terms) as t
    where public.normalize_text(t) <> ''
    limit 10
  ),
  -- Dictionary dishes each term resolves to: every exact name/alias match...
  exact_dishes as (
    select i.term, d.id as dish_id, d.search_terms
    from input i
    join public.dishes d on i.norm = any (d.search_terms)
  ),
  -- ...or, when there is none (likely a typo like "mofngo"), the single
  -- closest-spelled dish.
  fuzzy_dishes as (
    select distinct on (i.term) i.term, d.id as dish_id, d.search_terms
    from input i
    cross join public.dishes d
    cross join lateral (
      select max(extensions.similarity(s, i.norm)) as sim from unnest(d.search_terms) s
    ) x
    where char_length(i.norm) >= 5
      and x.sim >= 0.5
      and not exists (select 1 from exact_dishes e where e.term = i.term)
    order by i.term, x.sim desc, d.id
  ),
  term_dishes as (
    select * from exact_dishes
    union all
    select * from fuzzy_dishes
  ),
  -- Text patterns per term. Fuzzy text matching is only allowed for raw terms
  -- that resolved to no dish (unknown dish names / typos); dictionary aliases
  -- must match as whole words to avoid e.g. "lechon" ~ "leche".
  patterns as (
    select i.term, i.norm as pattern,
           not exists (select 1 from term_dishes td where td.term = i.term) as allow_fuzzy
    from input i
    union
    select td.term, unnest(td.search_terms), false from term_dishes td
  ),
  origin as (
    select case when search_restaurants.lat is not null and search_restaurants.lng is not null
             then extensions.st_setsrid(extensions.st_makepoint(search_restaurants.lng, search_restaurants.lat), 4326)::extensions.geography
           end as g
  ),
  candidates as (
    select r.*
    from public.restaurants r, origin o
    where r.is_listed
      and (p_restaurant_id is null or r.id = p_restaurant_id)
      and (p_municipality_id is null or r.municipality_id = p_municipality_id)
      and (p_region is null or exists (select 1 from public.municipalities m
                                       where m.id = r.municipality_id and m.region = p_region))
      and (radius_km is null or o.g is null
           or extensions.st_dwithin(r.location, o.g, radius_km * 1000))
  ),
  item_matches as (
    select distinct m.restaurant_id, m.id as item_id, m.name, m.price, m.position, p.term
    from public.menu_items m
    join candidates c on c.id = m.restaurant_id
    join patterns p
      on m.search_text ~ ('\m' || p.pattern || '(s|es)?\M')
      or (p.allow_fuzzy and char_length(p.pattern) >= 5
          and extensions.strict_word_similarity(p.pattern, m.search_text) >= 0.6)
    where m.is_available
    union
    select distinct m.restaurant_id, m.id, m.name, m.price, m.position, td.term
    from public.menu_items m
    join candidates c on c.id = m.restaurant_id
    join term_dishes td on td.dish_id = m.dish_id
    where m.is_available
  ),
  per_restaurant as (
    select im.restaurant_id,
           array_agg(distinct im.term order by im.term) as matched_terms,
           count(distinct im.term)::int as match_count,
           jsonb_agg(distinct jsonb_build_object(
             'id', im.item_id, 'name', im.name, 'price', im.price, 'term', im.term, 'position', im.position
           )) as matched_items
    from item_matches im
    group by im.restaurant_id
  )
  select c.id, c.slug, c.name, mu.name, mu.region, c.address, c.price_range, c.cuisine_tags,
         c.cover_photo_path,
         extensions.st_y(c.location::extensions.geometry),
         extensions.st_x(c.location::extensions.geometry),
         case when o.g is not null and c.location is not null
              then round((extensions.st_distance(c.location, o.g) / 1000)::numeric, 1)::double precision end,
         (select count(*)::int from input),
         pr.match_count,
         pr.matched_terms,
         pr.matched_items
  from per_restaurant pr
  join candidates c on c.id = pr.restaurant_id
  left join public.municipalities mu on mu.id = c.municipality_id
  cross join origin o
  order by pr.match_count desc,
           case when o.g is not null then extensions.st_distance(c.location, o.g) end asc nulls last,
           c.name asc
  limit greatest(1, least(max_results, 100));
$$;

grant execute on function public.search_restaurants to anon, authenticated;

-- Autocomplete for the dish chip input.
create or replace function public.suggest_dishes(q text, max_results integer default 8)
returns table (id integer, slug text, name_es text, name_en text, score real)
language sql stable
set search_path = ''
as $$
  with n as (select public.normalize_text(q) as v)
  select d.id, d.slug, d.name_es, d.name_en,
         max(case when s like n.v || '%' then 1.0
                  when s like '% ' || n.v || '%' then 0.9
                  else extensions.similarity(s, n.v) end)::real as score
  from public.dishes d, n, unnest(d.search_terms) s
  where char_length(n.v) >= 2
    and (s like '%' || n.v || '%' or extensions.similarity(s, n.v) >= 0.35)
  group by d.id, d.slug, d.name_es, d.name_en
  order by score desc, d.name_es
  limit greatest(1, least(max_results, 20));
$$;

grant execute on function public.suggest_dishes to anon, authenticated;
