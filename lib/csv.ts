/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF, ; or , delimiters). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface MenuCsvRow {
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
}

const HEADER = /^(nombre|name|plato|dish)$/i;

/** Map CSV rows (name, description, price, category) to menu items. */
export function parseMenuCsv(text: string, maxRows = 300): MenuCsvRow[] {
  const rows = parseCsv(text);
  if (rows.length && HEADER.test(rows[0][0]?.trim() ?? "")) rows.shift();
  return rows.slice(0, maxRows).flatMap(([name = "", description = "", price = "", category = ""]) => {
    const n = name.trim().slice(0, 160);
    if (!n) return [];
    const p = Number(price.replace(/[$\s]/g, "").replace(",", "."));
    return [{
      name: n,
      description: description.trim() || null,
      price: price.trim() !== "" && Number.isFinite(p) && p >= 0 ? Math.round(p * 100) / 100 : null,
      category: category.trim() || null,
    }];
  });
}
