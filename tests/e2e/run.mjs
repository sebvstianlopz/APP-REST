// End-to-end tests of the diner flow on a phone-sized viewport.
// Expects the app at BASE_URL (default http://localhost:3000) backed by the
// demo seed — e.g. `node tests/e2e/mock-supabase.mjs` + `npm run dev` with
// NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let browser;
let context;

before(async () => {
  browser = await chromium.launch();
  context = await browser.newContext({ ...devices["iPhone 13"] });
  // Map tiles are third-party; don't depend on them in tests.
  await context.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 204, body: "" }));
});
after(async () => browser?.close());

describe("diner flow", () => {
  it("searches several dishes in a town, ranks full matches first, and opens the menu", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/es`);

    const input = page.getByRole("combobox", { name: "¿Qué se te antoja?" });
    await input.fill("mofon");
    const option = page.getByRole("option", { name: /^Mofongo Mofongo \(mashed/ });
    await option.waitFor();
    await option.click();
    await input.fill("alcapurrias");
    await input.press("Enter");
    assert.equal(await page.locator(".chip").count(), 2);

    await page.getByLabel("¿Dónde?").selectOption("municipio:caguas");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.waitForURL(/\/es\/buscar\?platos=Mofongo%2Calcapurrias&municipio=caguas/);

    const heading = page.getByRole("heading", { level: 1 });
    assert.match(await heading.innerText(), /1 restaurante con Mofongo o alcapurrias\s+en Caguas/);
    const first = page.locator("article").first();
    assert.match(await first.innerText(), /El Fogón de la Abuela[\s\S]*¡Tiene todo lo que buscas!/);

    await page.getByRole("tab", { name: "Mapa" }).click();
    await page.locator(".leaflet-marker-icon .pin").first().waitFor();
    assert.equal(await page.locator(".leaflet-marker-icon .pin").count(), 1);
    await page.getByRole("tab", { name: "Lista" }).click();

    await first.getByRole("link", { name: "El Fogón de la Abuela" }).click();
    await page.waitForURL(/\/es\/restaurantes\/el-fogon-de-la-abuela\?platos=/);
    const matched = page.getByRole("region", { name: /Lo que buscabas/ });
    assert.equal(await matched.getByRole("listitem").count(), 2);
    assert.ok(await page.getByRole("link", { name: /Llamar/ }).getAttribute("href").then((h) => h?.startsWith("tel:")));
    await page.close();
  });

  it("switches language and keeps the search", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/es/buscar?platos=pinchos`);
    await page.getByRole("link", { name: "Cambiar idioma a inglés" }).click();
    await page.waitForURL(`${BASE}/en/buscar?platos=pinchos`);
    assert.match(await page.getByRole("heading", { level: 1 }).innerText(), /1 restaurant with pinchos/);
    await page.close();
  });

  it("explains when nothing matches and offers to widen the search", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/es/buscar?platos=langosta&region=sur`);
    await page.getByRole("heading", { name: "No encontramos ese antojo por aquí" }).waitFor();
    await page.getByRole("link", { name: "Buscar en toda la isla" }).click();
    await page.waitForURL(/platos=langosta$/);
    assert.match(await page.locator("article").first().innerText(), /Brisas de Fajardo/);
    await page.close();
  });

  it("hides restaurants without an active membership", async () => {
    const page = await context.newPage();
    const res = await page.goto(`${BASE}/es/restaurantes/el-rincon-cerrado`);
    assert.equal(res.status(), 404);
    await page.close();
  });

  it("sends signed-out visitors from the dashboard to sign in", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/es/panel`);
    await page.waitForURL(/\/es\/entrar\?owner=1/);
    await page.getByRole("heading", { name: "Registra tu restaurante" }).waitFor();
    await page.close();
  });
});
