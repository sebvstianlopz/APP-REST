// Tiny stand-in for the Supabase REST API (PostgREST) used ONLY for local
// UI/e2e testing without a Supabase project. It implements just what the
// public pages call — RPCs and simple table selects — by running the real SQL
// functions in a local Postgres as the `anon` role, so RLS still applies.
//
//   TEST_DATABASE_URL=postgres://... node tests/e2e/mock-supabase.mjs   (port 54321)
import http from "node:http";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/apprest_test",
});
const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);
const IDENT = /^[a-z_][a-z0-9_]*$/;

async function asAnon(sql, params) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role anon");
    const res = await c.query(sql, params);
    await c.query("commit");
    return res;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

http
  .createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") return send(res, 204);
      const url = new URL(req.url, `http://localhost:${PORT}`);

      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (rpc && req.method === "POST") {
        const fn = rpc[1];
        const args = await readJson(req);
        const keys = Object.keys(args).filter((k) => IDENT.test(k));
        const sql = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
        const { rows, fields } = await asAnon(sql, keys.map((k) => args[k]));
        // Scalar functions come back as a single column named after the function.
        if (fields.length === 1 && fields[0].name === fn) return send(res, 200, rows[0]?.[fn] ?? null);
        return send(res, 200, rows);
      }

      const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
      if (table && req.method === "GET") {
        const cols = (url.searchParams.get("select") ?? "*").split(",").map((c) => c.trim());
        if (!cols.every((c) => c === "*" || IDENT.test(c))) return send(res, 400, { message: "unsupported select" });
        const [orderCol, dir] = (url.searchParams.get("order") ?? "").split(".");
        const order = orderCol && IDENT.test(orderCol) ? ` order by ${orderCol} ${dir === "desc" ? "desc" : "asc"}` : "";
        const { rows } = await asAnon(`select ${cols.join(", ")} from public.${table[1]}${order}`);
        return send(res, 200, rows);
      }

      if (url.pathname.startsWith("/auth/v1/")) return send(res, 401, { message: "no session (mock)" });
      send(res, 404, { message: `mock-supabase: ${req.method} ${url.pathname} not implemented` });
    } catch (e) {
      send(res, 400, { message: String(e.message ?? e) });
    }
  })
  .listen(PORT, () => console.log(`mock-supabase listening on :${PORT}`));
