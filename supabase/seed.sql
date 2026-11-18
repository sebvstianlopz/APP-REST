-- =========================================================================
-- DEMO DATA for local development only (fictional restaurants).
-- Run after the migrations.  `supabase db reset` applies this automatically.
-- =========================================================================

-- Helper: point from lat/lng
create or replace function pg_temp.pt(lat double precision, lng double precision)
returns extensions.geography language sql immutable as
$$ select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography $$;

insert into public.restaurants
  (id, slug, name, description_es, description_en, address, municipality_id, location, phone,
   price_range, cuisine_tags, status, hours)
values
  ('00000000-0000-4000-8000-000000000001', 'el-fogon-de-la-abuela', 'El Fogón de la Abuela',
   'Comida criolla casera, como la de abuela.', 'Home-style Puerto Rican food, just like grandma''s.',
   'Calle Padial 12, Caguas', 13, pg_temp.pt(18.2345, -66.0371), '787-555-0101', 2, '{criolla}', 'active',
   '{"mon":"11:00-20:00","tue":"11:00-20:00","wed":"11:00-20:00","thu":"11:00-20:00","fri":"11:00-22:00","sat":"11:00-22:00","sun":"11:00-18:00"}'),
  ('00000000-0000-4000-8000-000000000002', 'kiosko-la-ola', 'Kiosko La Ola',
   'Frituras frente al mar.', 'Beachfront fritters.',
   'Carr. 187 Km 4, Piñones, Loíza', 45, pg_temp.pt(18.4440, -65.9500), '787-555-0102', 1, '{frituras,kiosko}', 'active',
   '{"fri":"10:00-21:00","sat":"10:00-22:00","sun":"10:00-21:00"}'),
  ('00000000-0000-4000-8000-000000000003', 'mar-y-tierra-ponce', 'Mar y Tierra',
   'Mariscos frescos y cortes a la parrilla.', 'Fresh seafood and grilled cuts.',
   'Paseo La Guancha, Ponce', 58, pg_temp.pt(17.9690, -66.6170), '787-555-0103', 3, '{mariscos,parrilla}', 'active',
   '{"tue":"12:00-22:00","wed":"12:00-22:00","thu":"12:00-22:00","fri":"12:00-23:00","sat":"12:00-23:00","sun":"12:00-21:00"}'),
  ('00000000-0000-4000-8000-000000000004', 'lechonera-el-cerdo-feliz', 'Lechonera El Cerdo Feliz',
   'Lechón a la vara todos los fines de semana.', 'Spit-roasted pork every weekend.',
   'Carr. 184, Guavate, Cayey', 18, pg_temp.pt(18.1290, -66.0880), '787-555-0104', 2, '{lechonera,criolla}', 'active',
   '{"sat":"09:00-19:00","sun":"09:00-19:00"}'),
  ('00000000-0000-4000-8000-000000000005', 'cafe-del-viejo-san-juan', 'Café del Viejo San Juan',
   'Desayunos, mallorcas y café de la montaña.', 'Breakfast, mallorcas and mountain-grown coffee.',
   'Calle San Sebastián 150, San Juan', 65, pg_temp.pt(18.4669, -66.1170), '787-555-0105', 1, '{cafe,desayuno}', 'active',
   '{"mon":"07:00-14:00","tue":"07:00-14:00","wed":"07:00-14:00","thu":"07:00-14:00","fri":"07:00-14:00","sat":"08:00-15:00","sun":"08:00-15:00"}'),
  ('00000000-0000-4000-8000-000000000006', 'sabor-del-oeste', 'Sabor del Oeste',
   'Fusión criolla en el corazón de Mayagüez.', 'Creole fusion in the heart of Mayagüez.',
   'Calle Méndez Vigo 45, Mayagüez', 50, pg_temp.pt(18.2015, -67.1395), '787-555-0106', 2, '{criolla,fusion}', 'active',
   '{"wed":"17:00-23:00","thu":"17:00-23:00","fri":"17:00-00:00","sat":"12:00-00:00"}'),
  ('00000000-0000-4000-8000-000000000007', 'la-placita-bayamon', 'La Placita Bayamón',
   'Pinchos, tripletas y cerveza fría.', 'Skewers, tripletas and cold beer.',
   'Ave. Santa Juanita, Bayamón', 11, pg_temp.pt(18.3920, -66.1600), '787-555-0107', 1, '{kiosko,sandwiches}', 'active',
   '{"thu":"18:00-02:00","fri":"18:00-02:00","sat":"18:00-02:00"}'),
  ('00000000-0000-4000-8000-000000000008', 'brisas-de-fajardo', 'Brisas de Fajardo',
   'Pescado del día y mofongos rellenos.', 'Catch of the day and stuffed mofongos.',
   'Villa Marina, Fajardo', 27, pg_temp.pt(18.3370, -65.6340), '787-555-0108', 3, '{mariscos}', 'active',
   '{"mon":"11:00-21:00","fri":"11:00-22:00","sat":"11:00-22:00","sun":"11:00-21:00"}'),
  -- Membership lapsed: must NEVER appear in search.
  ('00000000-0000-4000-8000-000000000009', 'el-rincon-cerrado', 'El Rincón Cerrado',
   'Membresía vencida (dato de prueba).', 'Lapsed membership (test data).',
   'Calle Principal, Caguas', 13, pg_temp.pt(18.2300, -66.0400), '787-555-0109', 2, '{criolla}', 'active', '{}'),
  -- Paid but not yet approved by an admin: must not appear either.
  ('00000000-0000-4000-8000-000000000010', 'nuevo-sabor-humacao', 'Nuevo Sabor',
   'Pendiente de revisión (dato de prueba).', 'Pending review (test data).',
   'Palmas del Mar, Humacao', 36, pg_temp.pt(18.0900, -65.8000), '787-555-0110', 2, '{criolla}', 'pending_review', '{}');

-- Memberships (demo Stripe ids)
insert into public.subscriptions (restaurant_id, stripe_customer_id, stripe_subscription_id, price_id, status, current_period_end)
select id, 'cus_demo_' || right(id::text, 2), 'sub_demo_' || right(id::text, 2), 'price_demo_monthly',
       case when slug = 'el-rincon-cerrado' then 'canceled' else 'active' end,
       now() + interval '30 days'
from public.restaurants;

-- Menus ------------------------------------------------------------------
insert into public.menu_items (restaurant_id, category, name, description, price, dish_id, position)
select r.id, v.category, v.name, v.description, v.price, d.id, v.position
from (values
  -- El Fogón de la Abuela (Caguas)
  ('el-fogon-de-la-abuela', 'Platos', 'Mofongo relleno de pollo', 'Plátano majado con ajo, relleno de pollo guisado', 14.95, 'mofongo', 1),
  ('el-fogon-de-la-abuela', 'Platos', 'Arroz con gandules y pernil', 'Con ensalada de papa', 13.50, 'pernil', 2),
  ('el-fogon-de-la-abuela', 'Platos', 'Pastelón de amarillos', null, 12.00, 'pastelon', 3),
  ('el-fogon-de-la-abuela', 'Platos', 'Carne guisada con arroz blanco y habichuelas', null, 11.95, 'carne-guisada', 4),
  ('el-fogon-de-la-abuela', 'Frituras', 'Alcapurrias de carne (2)', null, 4.50, 'alcapurrias', 5),
  ('el-fogon-de-la-abuela', 'Postres', 'Flan de queso', null, 4.00, 'flan', 6),
  ('el-fogon-de-la-abuela', 'Postres', 'Tembleque', null, 3.75, 'tembleque', 7),
  -- Kiosko La Ola (Loíza)
  ('kiosko-la-ola', 'Frituras', 'Alcapurria de jueyes', 'Masa de yautía y guineo rellena de juey', 3.50, 'alcapurrias', 1),
  ('kiosko-la-ola', 'Frituras', 'Bacalaíto gigante', null, 3.00, 'bacalaitos', 2),
  ('kiosko-la-ola', 'Frituras', 'Empanadilla de carrucho', null, 4.25, 'empanadillas', 3),
  ('kiosko-la-ola', 'Frituras', 'Relleno de papa', null, 2.75, 'rellenos-de-papa', 4),
  ('kiosko-la-ola', 'Frituras', 'Pastelillo de pizza', null, 3.00, 'empanadillas', 5),
  ('kiosko-la-ola', 'Bebidas', 'Agua de coco', 'Del coco, frente a ti', 3.00, null, 6),
  ('kiosko-la-ola', 'Bebidas', 'Piña colada sin alcohol', null, 5.00, 'pina-colada', 7),
  -- Mar y Tierra (Ponce)
  ('mar-y-tierra-ponce', 'Mariscos', 'Chillo entero frito', 'Con tostones y ensalada', 26.00, 'chillo-frito', 1),
  ('mar-y-tierra-ponce', 'Mariscos', 'Mofongo de mariscos', 'Camarones, pulpo y calamar en salsa criolla', 24.50, 'mofongo-de-mariscos', 2),
  ('mar-y-tierra-ponce', 'Mariscos', 'Camarones al ajillo', null, 19.95, 'mariscos-al-ajillo', 3),
  ('mar-y-tierra-ponce', 'Mariscos', 'Ensalada de pulpo', null, 13.00, 'ensalada-de-pulpo', 4),
  ('mar-y-tierra-ponce', 'Parrilla', 'Churrasco con chimichurri', null, 28.00, 'churrasco', 5),
  ('mar-y-tierra-ponce', 'Acompañantes', 'Tostones', null, 4.00, 'tostones', 6),
  -- Lechonera El Cerdo Feliz (Cayey)
  ('lechonera-el-cerdo-feliz', 'Lechón', 'Lechón asado (por libra)', 'A la vara, con cuerito', 12.00, 'lechon-asado', 1),
  ('lechonera-el-cerdo-feliz', 'Lechón', 'Plato de pernil con arroz con gandules', null, 13.00, 'pernil', 2),
  ('lechonera-el-cerdo-feliz', 'Acompañantes', 'Morcilla', null, 3.00, 'morcilla', 3),
  ('lechonera-el-cerdo-feliz', 'Acompañantes', 'Guineítos en escabeche', null, 4.00, 'viandas', 4),
  ('lechonera-el-cerdo-feliz', 'Acompañantes', 'Pasteles de masa', 'Envueltos en hoja de plátano', 4.50, 'pasteles', 5),
  ('lechonera-el-cerdo-feliz', 'Postres', 'Arroz con dulce', null, 3.50, 'arroz-con-dulce', 6),
  -- Café del Viejo San Juan
  ('cafe-del-viejo-san-juan', 'Desayuno', 'Mallorca de jamón, huevo y queso', null, 6.50, 'mallorca', 1),
  ('cafe-del-viejo-san-juan', 'Desayuno', 'Revoltillo con tostadas', null, 7.00, 'revoltillo', 2),
  ('cafe-del-viejo-san-juan', 'Bebidas', 'Café con leche', 'Café de Yauco', 2.75, 'cafe', 3),
  ('cafe-del-viejo-san-juan', 'Bebidas', 'Batida de parcha', null, 5.50, 'batida', 4),
  ('cafe-del-viejo-san-juan', 'Repostería', 'Quesito de guayaba', null, 2.25, 'quesitos', 5),
  ('cafe-del-viejo-san-juan', 'Almuerzo', 'Sándwich cubano', null, 9.50, 'sandwich-cubano', 6),
  -- Sabor del Oeste (Mayagüez)
  ('sabor-del-oeste', 'Entremeses', 'Sorullitos de maíz con mayoketchup', null, 7.00, 'sorullitos', 1),
  ('sabor-del-oeste', 'Entremeses', 'Arañitas de plátano', null, 6.50, 'arañitas', 2),
  ('sabor-del-oeste', 'Platos', 'Trifongo con churrasco', 'Plátano verde, maduro y yuca', 22.00, 'mofongo', 3),
  ('sabor-del-oeste', 'Platos', 'Chuleta kan kan', 'Con arroz mamposteao', 21.00, 'chuleta-kan-kan', 4),
  ('sabor-del-oeste', 'Platos', 'Canoa de amarillo rellena de carne', null, 15.00, 'canoas', 5),
  ('sabor-del-oeste', 'Postres', 'Tres leches de coquito', null, 7.00, 'tres-leches', 6),
  -- La Placita Bayamón
  ('la-placita-bayamon', 'Kiosko', 'Pincho de pollo con pan', null, 4.00, 'pinchos', 1),
  ('la-placita-bayamon', 'Kiosko', 'Pincho de cerdo', null, 4.00, 'pinchos', 2),
  ('la-placita-bayamon', 'Sándwiches', 'Tripleta especial', 'Jamón, pollo y carne', 9.00, 'tripleta', 3),
  ('la-placita-bayamon', 'Sándwiches', 'Jibarito de bistec', null, 10.00, 'jibarito', 4),
  ('la-placita-bayamon', 'Frituras', 'Alcapurrias de guineo', null, 2.50, 'alcapurrias', 5),
  ('la-placita-bayamon', 'Kiosko', 'Hamburguesa de la casa', null, 8.50, 'hamburguesa', 6),
  -- Brisas de Fajardo
  ('brisas-de-fajardo', 'Mariscos', 'Mofongo relleno de camarones', null, 21.00, 'mofongo-de-mariscos', 1),
  ('brisas-de-fajardo', 'Mariscos', 'Pescado del día frito', 'Pregunte por la pesca del día', 24.00, 'chillo-frito', 2),
  ('brisas-de-fajardo', 'Mariscos', 'Salmorejo de jueyes', null, 18.00, 'salmorejo-de-jueyes', 3),
  ('brisas-de-fajardo', 'Mariscos', 'Langosta a la parrilla', 'Según disponibilidad', 38.00, 'langosta', 4),
  ('brisas-de-fajardo', 'Acompañantes', 'Arroz con gandules', null, 4.50, 'arroz-con-gandules', 5),
  -- El Rincón Cerrado (lapsed)
  ('el-rincon-cerrado', 'Platos', 'Mofongo de pollo', null, 13.00, 'mofongo', 1),
  ('el-rincon-cerrado', 'Frituras', 'Alcapurrias', null, 3.00, 'alcapurrias', 2),
  -- Nuevo Sabor (pending review)
  ('nuevo-sabor-humacao', 'Platos', 'Mofongo de yuca', null, 13.00, 'mofongo', 1)
) as v (restaurant_slug, category, name, description, price, dish_slug, position)
join public.restaurants r on r.slug = v.restaurant_slug
left join public.dishes d on d.slug = v.dish_slug;
