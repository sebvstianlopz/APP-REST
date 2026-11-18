# Antojo PR

**Find restaurants in Puerto Rico by the dishes you're craving.** Diners type one or more dishes
(*mofongo, alcapurrias, chillo frito…*) and the app shows every member restaurant that serves at
least one of them, ranked by how many of the dishes it has and how close it is. Restaurants pay a
monthly or yearly membership (Stripe) to publish their menu, and that membership is the revenue model.

> "Antojo PR" is a working name. Change it in `messages/*.json` (`brand.name`), `app/manifest.ts` and `components/logo.tsx`.

| | |
|---|---|
| App | Next.js 15 (App Router, Server Components, Server Actions), TypeScript, Tailwind CSS 4 |
| Languages | Spanish (default) and English via `next-intl`, routes `/es/…` and `/en/…` |
| Backend | Supabase: Postgres + Auth (magic link and Google) + Storage |
| Search | Postgres `pg_trgm` + `unaccent` (typos and accents) + PostGIS (distance) |
| Maps | Leaflet + OpenStreetMap; address lookup with Nominatim |
| Billing | Stripe Checkout (subscriptions), Customer Portal, webhooks |
| Install | Mobile-first PWA (manifest, offline page) |

## How it works

### For diners
1. **`/es`**: type dishes as chips (autocomplete from a bilingual dish dictionary) and pick *near me*, a town or a region.
2. **`/es/buscar?platos=mofongo,alcapurrias&municipio=caguas`**: results ranked by dishes covered, then distance. Each card shows which of the requested dishes the restaurant has, with prices. A list/map toggle is available on phones.
3. **`/es/restaurantes/<slug>`**: full menu with the searched dishes highlighted, plus hours, a call button, directions and a map.

Search (`search_restaurants()` in `supabase/migrations/…_search.sql`) understands:
- accents and capitals: `alcapurías` → *Alcapurrias*
- plurals: `alcapurria` → *alcapurrias*
- typos: `mofngo` → *mofongo*
- English names and aliases: `roast pork` → *pernil*, `trifongo` → *mofongo*

It avoids false friends: `pasteles` ≠ *pastelón*, `lechón` ≠ *café con leche*.

### For restaurant owners (`/es/para-restaurantes` → `/es/panel`)
1. Sign up with a magic link (or Google) and create the restaurant (it starts as a **draft**).
2. **Profile**: address, a draggable map pin, hours, phone, price range, cover photo.
3. **Menu**: add and edit dishes, or **import a CSV** (`nombre,descripcion,precio,categoria`). Each dish is automatically tagged with the matching dictionary dish.
4. **Membership**: Stripe Checkout with a free trial. Promotion codes are enabled, e.g. for "founding member" discounts.
5. Once the membership is active, a draft automatically moves to **review**. An admin approves it and it goes **live**.

A restaurant is visible to the public only when it is approved **and** its membership is `active`, `trialing` or `past_due` (Stripe's retry grace period). This is enforced in the database (`is_listed`, kept in sync by triggers) and by row-level security, not just in the UI.

### For admins (`/es/admin`)
Review queue (approve or send back to draft), suspend or reactivate restaurants, and add dishes and aliases to the dictionary.

## Project layout

```
app/[locale]/            pages (home, buscar, restaurantes/[slug], para-restaurantes, entrar, panel, admin)
app/api/stripe/          checkout, portal, webhook
app/auth/callback/       magic-link / OAuth code exchange
components/              UI (search form, result cards, maps, …)
lib/                     data access, search params, CSV import, billing mapping, Supabase clients
messages/{es,en}.json    all UI copy
supabase/migrations/     schema, RLS, search, storage, reference data (78 municipalities, ~100 dishes)
supabase/seed.sql        fictional demo restaurants (development only)
tests/unit/              pure TypeScript tests
tests/db/                SQL tests: search behaviour and RLS (run against Postgres)
tests/e2e/               browser tests of the diner flow + a mock Supabase REST server for local runs
```

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations:
   ```bash
   npx supabase init        # keeps the existing supabase/migrations folder
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   For local development with demo data, `npx supabase start && npx supabase db reset` also runs `supabase/seed.sql`.
3. **Auth → URL configuration**: set the Site URL to your domain and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to the redirect URLs. Enable the Google provider if you want the Google button.
4. Make yourself an admin (SQL editor):
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

### 2. Stripe
1. Create a product **"Membresía Antojo PR"** with two recurring prices (e.g. $29/month and $290/year).
2. **Settings → Billing → Customer portal**: enable it so owners can update cards, switch plans and cancel.
3. **Developers → Webhooks**: add an endpoint at `https://<your-domain>/api/stripe/webhook` with these events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`,
   `invoice.paid`, `invoice.payment_failed`.
4. Optional: create a coupon and promotion code for founding members.

### 3. Environment
Copy `.env.example` to `.env.local` and fill it in. Never commit real keys. The displayed prices
(`NEXT_PUBLIC_PRICE_MONTHLY_USD`, `NEXT_PUBLIC_PRICE_YEARLY_USD`, default 29 and 290) should match your Stripe prices.

### 4. Run
```bash
npm install
npm run dev
```
Deploy to Vercel (or any Node host) with the same environment variables.

## Tests

```bash
npm run lint && npm run typecheck
npm test                      # unit tests (search params, CSV import, Stripe mapping + webhook signatures)
```

Database tests need a Postgres 15+ with PostGIS. `scripts/db-reset-local.sh` builds a throwaway database from the migrations and the demo seed, using a small shim in place of Supabase's `auth` schema:
```bash
export TEST_DATABASE_URL=postgres://postgres@localhost:5432/apprest_test
./scripts/db-reset-local.sh
npm run test:db               # 21 tests: ranking, typo/accent/alias matching, visibility, RLS
```

Browser tests (diner flow on an iPhone viewport) can run without a Supabase project:
```bash
node tests/e2e/mock-supabase.mjs &      # serves the RPCs from TEST_DATABASE_URL as the anon role
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=x npm run dev &
npm run test:e2e
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, the build, and the database tests against a PostGIS service.
