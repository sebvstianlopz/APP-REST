import { REGIONS, type Region } from "./types";

export const MAX_DISHES = 10;
export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export const DEFAULT_RADIUS = 25;

export interface SearchQuery {
  dishes: string[];
  municipio?: string;
  region?: Region;
  lat?: number;
  lng?: number;
  radio?: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function num(v: string | undefined, min: number, max: number) {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Split, trim and de-duplicate (case/accent-insensitively) the requested dishes. */
export function parseDishes(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const dish = part.trim().replace(/\s+/g, " ").slice(0, 60);
    const key = dish.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    if (dish && !seen.has(key)) {
      seen.add(key);
      out.push(dish);
    }
  }
  return out.slice(0, MAX_DISHES);
}

/** Parse /buscar URL params into a validated query. Invalid values are dropped. */
export function parseSearchParams(params: RawParams): SearchQuery {
  const q: SearchQuery = { dishes: parseDishes(first(params.platos)) };
  const lat = num(first(params.lat), 17.8, 18.6); // Puerto Rico bounding box (incl. Vieques/Culebra)
  const lng = num(first(params.lng), -67.4, -65.1);
  if (lat !== undefined && lng !== undefined) {
    q.lat = Math.round(lat * 1e4) / 1e4;
    q.lng = Math.round(lng * 1e4) / 1e4;
    const radio = num(first(params.radio), 1, 150);
    q.radio = radio ?? DEFAULT_RADIUS;
    return q;
  }
  const municipio = first(params.municipio);
  if (municipio && /^[a-z0-9-]{2,40}$/.test(municipio)) q.municipio = municipio;
  const region = first(params.region);
  if (!q.municipio && region && (REGIONS as string[]).includes(region)) q.region = region as Region;
  return q;
}

/** Build the /buscar query string for a query (inverse of parseSearchParams). */
export function toSearchString(q: SearchQuery): string {
  const p = new URLSearchParams();
  if (q.dishes.length) p.set("platos", q.dishes.join(","));
  if (q.lat !== undefined && q.lng !== undefined) {
    p.set("lat", String(q.lat));
    p.set("lng", String(q.lng));
    if (q.radio) p.set("radio", String(q.radio));
  } else if (q.municipio) p.set("municipio", q.municipio);
  else if (q.region) p.set("region", q.region);
  return p.toString();
}
