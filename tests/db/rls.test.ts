import type { PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { asRole, pool } from "./helpers";

afterAll(() => pool.end());

const OWNER_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const OWNER_B = "bbbbbbbb-0000-4000-8000-00000000000b";

/** Creates two owners; A owns the (pending) Nuevo Sabor, B owns Kiosko La Ola. */
async function setupOwners(c: PoolClient) {
  await c.query("reset role");
  await c.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'a@example.com', '{"role":"owner"}'), ($2, 'b@example.com', '{"role":"owner"}')`,
    [OWNER_A, OWNER_B],
  );
  await c.query(`update public.restaurants set owner_id = $1 where slug = 'nuevo-sabor-humacao'`, [OWNER_A]);
  await c.query(`update public.restaurants set owner_id = $1 where slug = 'kiosko-la-ola'`, [OWNER_B]);
}

async function become(c: PoolClient, role: "anon" | "authenticated", sub?: string) {
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub, role })]);
  await c.query(`set local role ${role}`);
}

describe("row level security", () => {
  it("anonymous users only see listed restaurants and their menus", async () => {
    await asRole("anon", async (c) => {
      const { rows } = await c.query("select slug from public.restaurants");
      const slugs = rows.map((r) => r.slug);
      expect(slugs).toHaveLength(8);
      expect(slugs).not.toContain("el-rincon-cerrado");
      expect(slugs).not.toContain("nuevo-sabor-humacao");

      const hidden = await c.query(
        `select count(*)::int as n from public.menu_items mi
           join public.restaurants r on r.id = mi.restaurant_id`,
      );
      const all = await c.query(`select count(*)::int as n from public.menu_items`);
      expect(all.rows[0].n).toBe(hidden.rows[0].n);
      expect(all.rows[0].n).toBeGreaterThan(0);
    });
  });

  it("anonymous users cannot write anything", async () => {
    await asRole("anon", async (c) => {
      await expect(c.query(`update public.restaurants set name = 'Hacked'`)).rejects.toThrow(/permission denied/);
    });
    await asRole("anon", async (c) => {
      await expect(c.query(`delete from public.menu_items`)).rejects.toThrow(/permission denied/);
    });
    await asRole("anon", async (c) => {
      await expect(
        c.query(`insert into public.subscriptions (restaurant_id, status)
                 select id, 'active' from public.restaurants limit 1`),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("new sign-ups become diners or owners, never admins", async () => {
    await asRole("service_role", async (c) => {
      await c.query("reset role");
      await c.query(
        `insert into auth.users (id, raw_user_meta_data) values
           ('cccccccc-0000-4000-8000-00000000000c', '{"role":"admin"}'),
           ('dddddddd-0000-4000-8000-00000000000d', '{"role":"owner","locale":"en"}')`,
      );
      const { rows } = await c.query(
        `select id, role, locale from public.profiles where id in
           ('cccccccc-0000-4000-8000-00000000000c','dddddddd-0000-4000-8000-00000000000d') order by id`,
      );
      expect(rows.map((r) => [r.role, r.locale])).toEqual([
        ["diner", "es"],
        ["owner", "en"],
      ]);
    });
  });

  it("users cannot promote themselves to admin", async () => {
    await asRole("anon", async (c) => {
      await setupOwners(c);
      await become(c, "authenticated", OWNER_A);
      await expect(c.query(`update public.profiles set role = 'admin' where id = $1`, [OWNER_A])).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it("owners see and edit their own unlisted restaurant and menu", async () => {
    await asRole("anon", async (c) => {
      await setupOwners(c);
      await become(c, "authenticated", OWNER_A);
      const mine = await c.query(`select slug from public.restaurants where owner_id = $1`, [OWNER_A]);
      expect(mine.rows.map((r) => r.slug)).toEqual(["nuevo-sabor-humacao"]);

      const upd = await c.query(
        `update public.menu_items set price = 15 where restaurant_id =
           (select id from public.restaurants where slug = 'nuevo-sabor-humacao')`,
      );
      expect(upd.rowCount).toBe(1);

      const ins = await c.query(
        `insert into public.menu_items (restaurant_id, name, price)
         select id, 'Tostones', 4 from public.restaurants where slug = 'nuevo-sabor-humacao'`,
      );
      expect(ins.rowCount).toBe(1);
    });
  });

  it("owners cannot touch another owner's menu", async () => {
    await asRole("anon", async (c) => {
      await setupOwners(c);
      await become(c, "authenticated", OWNER_A);
      const upd = await c.query(
        `update public.menu_items set price = 0 where restaurant_id =
           (select id from public.restaurants where slug = 'kiosko-la-ola')`,
      );
      expect(upd.rowCount).toBe(0);
      await expect(
        c.query(
          `insert into public.menu_items (restaurant_id, name, price)
           select id, 'Spam', 1 from public.restaurants where slug = 'kiosko-la-ola'`,
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("owners cannot approve themselves, list themselves or change ownership", async () => {
    await asRole("anon", async (c) => {
      await setupOwners(c);
      await become(c, "authenticated", OWNER_A);
      await c.query("savepoint s");
      await expect(
        c.query(`update public.restaurants set status = 'active' where slug = 'nuevo-sabor-humacao'`),
      ).rejects.toThrow(/Only an administrator/);
      await c.query("rollback to savepoint s");

      await c.query(
        `update public.restaurants set is_listed = true, owner_id = $1 where slug = 'nuevo-sabor-humacao'`,
        [OWNER_B],
      );
      await c.query("reset role");
      const { rows } = await c.query(
        `select is_listed, owner_id from public.restaurants where slug = 'nuevo-sabor-humacao'`,
      );
      expect(rows[0]).toEqual({ is_listed: false, owner_id: OWNER_A });
    });
  });

  it("new restaurants always start as drafts", async () => {
    await asRole("anon", async (c) => {
      await setupOwners(c);
      await become(c, "authenticated", OWNER_A);
      const { rows } = await c.query(
        `insert into public.restaurants (owner_id, slug, name, status)
         values ($1, 'mi-fonda', 'Mi Fonda', 'active') returning status, is_listed`,
        [OWNER_A],
      );
      expect(rows[0]).toEqual({ status: "draft", is_listed: false });
    });
  });

  it("owners only see their own membership", async () => {
    await asRole("anon", async (c) => {
      await setupOwners(c);
      await become(c, "authenticated", OWNER_B);
      const { rows } = await c.query(`select status from public.subscriptions`);
      expect(rows).toEqual([{ status: "active" }]);
    });
  });
});
