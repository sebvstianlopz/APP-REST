import { afterAll, describe, expect, it } from "vitest";
import { asOwner, asRole, pool, search } from "./helpers";

afterAll(() => pool.end());

const CAGUAS = { lat: 18.234, lng: -66.035 };
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("search_restaurants", () => {
  it("returns every listed restaurant serving at least one requested dish", async () => {
    const rows = await asRole("anon", (c) => search(c, ["mofongo", "alcapurrias"]));
    expect(names(rows).sort()).toEqual(
      [
        "Brisas de Fajardo",
        "El Fogón de la Abuela",
        "Kiosko La Ola",
        "La Placita Bayamón",
        "Mar y Tierra",
        "Sabor del Oeste",
      ].sort(),
    );
    for (const r of rows) {
      expect(r.requested_count).toBe(2);
      expect(r.match_count).toBeGreaterThanOrEqual(1);
      expect(r.matched_items.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("ranks restaurants covering more of the dishes first, then by distance", async () => {
    const rows = await asRole("anon", (c) => search(c, ["mofongo", "alcapurrias"], CAGUAS));
    expect(rows[0].name).toBe("El Fogón de la Abuela");
    expect(rows[0].match_count).toBe(2);
    expect(rows[0].matched_terms.sort()).toEqual(["alcapurrias", "mofongo"]);
    const singles = rows.slice(1);
    const distances = singles.map((r) => r.distance_km!);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("tolerates accents, typos and singular/plural", async () => {
    await asRole("anon", async (c) => {
      expect(names(await search(c, ["alcapurías"]))).toContain("Kiosko La Ola");
      expect(names(await search(c, ["ALCAPURRIA"]))).toContain("Kiosko La Ola");
      expect(names(await search(c, ["mofngo"]))).toContain("El Fogón de la Abuela");
      expect(names(await search(c, ["tripletta"]))).toEqual(["La Placita Bayamón"]);
    });
  });

  it("understands English names and aliases", async () => {
    await asRole("anon", async (c) => {
      const pork = names(await search(c, ["roast pork"]));
      expect(pork).toContain("Lechonera El Cerdo Feliz");
      expect(pork).toContain("El Fogón de la Abuela");
      expect(names(await search(c, ["salt cod fritters"]))).toEqual(["Kiosko La Ola"]);
      // "trifongo" is an alias of mofongo
      expect(names(await search(c, ["mofongo"]))).toContain("Sabor del Oeste");
    });
  });

  it("does not over-match related words", async () => {
    await asRole("anon", async (c) => {
      // pasteles != pastelón / pastelillo
      expect(names(await search(c, ["pasteles"]))).toEqual(["Lechonera El Cerdo Feliz"]);
      // lechón must not match "café con leche"
      expect(names(await search(c, ["lechon"]))).toEqual(["Lechonera El Cerdo Feliz"]);
    });
  });

  it("matches untagged menu items by their text", async () => {
    const rows = await asRole("anon", (c) => search(c, ["agua de coco"]));
    expect(names(rows)).toEqual(["Kiosko La Ola"]);
  });

  it("never shows restaurants with a lapsed membership or pending review", async () => {
    await asRole("anon", async (c) => {
      const all = names(await search(c, ["mofongo", "alcapurrias"]));
      expect(all).not.toContain("El Rincón Cerrado");
      expect(all).not.toContain("Nuevo Sabor");
    });
  });

  it("hides unavailable menu items", async () => {
    await asOwner(async (c) => {
      await c.query(`update public.menu_items set is_available = false where name = 'Pasteles de masa'`);
      expect(await search(c, ["pasteles"])).toEqual([]);
    });
  });

  it("filters by municipality, region and radius", async () => {
    await asRole("anon", async (c) => {
      expect(names(await search(c, ["mofongo"], { municipalityId: 13 }))).toEqual(["El Fogón de la Abuela"]);
      expect(names(await search(c, ["mofongo"], { region: "sur" }))).toEqual(["Mar y Tierra"]);
      const near = await search(c, ["alcapurrias"], { ...CAGUAS, radiusKm: 5 });
      expect(names(near)).toEqual(["El Fogón de la Abuela"]);
    });
  });

  it("ignores blank terms and returns nothing for unknown dishes", async () => {
    await asRole("anon", async (c) => {
      expect(await search(c, ["", "   "])).toEqual([]);
      expect(await search(c, ["xyzzy"])).toEqual([]);
    });
  });

  it("lights up a restaurant once its membership is activated and it is approved", async () => {
    await asOwner(async (c) => {
      expect(names(await search(c, ["mofongo de yuca"]))).not.toContain("Nuevo Sabor");
      await c.query(`update public.restaurants set status = 'active' where slug = 'nuevo-sabor-humacao'`);
      expect(names(await search(c, ["mofongo de yuca"]))).toContain("Nuevo Sabor");
      await c.query(
        `update public.subscriptions set status = 'canceled'
          where restaurant_id = (select id from public.restaurants where slug = 'nuevo-sabor-humacao')`,
      );
      expect(names(await search(c, ["mofongo de yuca"]))).not.toContain("Nuevo Sabor");
    });
  });
});

describe("suggest_dishes", () => {
  it("autocompletes partial input in either language", async () => {
    await asRole("anon", async (c) => {
      const q = async (s: string) =>
        (await c.query("select slug from public.suggest_dishes($1)", [s])).rows.map((r) => r.slug);
      expect(await q("alca")).toContain("alcapurrias");
      expect((await q("mofo"))[0]).toBe("mofongo");
      expect(await q("roast")).toContain("pernil");
      expect(await q("a")).toEqual([]);
    });
  });
});
