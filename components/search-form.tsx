"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { getBrowserClient } from "@/lib/supabase/client";
import { MAX_DISHES, RADIUS_OPTIONS, DEFAULT_RADIUS, toSearchString, type SearchQuery } from "@/lib/search-params";
import { REGIONS, type Municipality } from "@/lib/types";

interface Suggestion {
  id: number;
  slug: string;
  name_es: string;
  name_en: string;
}

type Where =
  | { kind: "all" }
  | { kind: "region"; value: string }
  | { kind: "municipio"; value: string }
  | { kind: "near"; lat: number; lng: number; radio: number };

function initialWhere(q?: SearchQuery): Where {
  if (q?.lat !== undefined && q?.lng !== undefined) return { kind: "near", lat: q.lat, lng: q.lng, radio: q.radio ?? DEFAULT_RADIUS };
  if (q?.municipio) return { kind: "municipio", value: q.municipio };
  if (q?.region) return { kind: "region", value: q.region };
  return { kind: "all" };
}

export function SearchForm({
  municipalities,
  initial,
  variant = "hero",
}: {
  municipalities: Municipality[];
  initial?: SearchQuery;
  variant?: "hero" | "compact";
}) {
  const t = useTranslations("searchForm");
  const tr = useTranslations("regions");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [dishes, setDishes] = useState<string[]>(initial?.dishes ?? []);
  const [text, setText] = useState("");
  const [where, setWhere] = useState<Where>(initialWhere(initial));
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const hintId = useId();

  // Debounced autocomplete from the dish dictionary.
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      const { data } = await getBrowserClient().rpc("suggest_dishes", { q, max_results: 6 });
      if (!cancelled) {
        setSuggestions((data ?? []) as Suggestion[]);
        setActive(-1);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [text]);

  const label = (s: Suggestion) => (locale === "en" ? s.name_en : s.name_es);

  function addDish(raw: string) {
    const dish = raw.trim().replace(/,+$/, "");
    if (!dish) return;
    setDishes((prev) => {
      const key = dish.toLowerCase();
      if (prev.some((d) => d.toLowerCase() === key) || prev.length >= MAX_DISHES) return prev;
      return [...prev, dish];
    });
    setText("");
    setSuggestions([]);
    setError(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === "Enter" || e.key === ",") {
      if (e.key === "Enter" && !text.trim()) return; // let Enter submit the form
      e.preventDefault();
      addDish(active >= 0 && open && suggestions[active] ? label(suggestions[active]) : text);
    } else if (e.key === "Backspace" && !text && dishes.length) {
      setDishes((d) => d.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function locateMe() {
    if (!("geolocation" in navigator)) return setGeoState("denied");
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("idle");
        setWhere({ kind: "near", lat: pos.coords.latitude, lng: pos.coords.longitude, radio: DEFAULT_RADIUS });
      },
      () => {
        setGeoState("denied");
        setWhere({ kind: "all" });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const all = text.trim() ? [...dishes, text.trim()] : dishes;
    if (!all.length) {
      setError(t("needDish"));
      inputRef.current?.focus();
      return;
    }
    const q: SearchQuery = { dishes: all };
    if (where.kind === "near") Object.assign(q, { lat: where.lat, lng: where.lng, radio: where.radio });
    if (where.kind === "municipio") q.municipio = where.value;
    if (where.kind === "region") q.region = where.value as SearchQuery["region"];
    setText("");
    setDishes(all);
    startTransition(() => router.push(`/buscar?${toSearchString(q)}`));
  }

  const selectValue = where.kind === "all" ? "" : where.kind === "near" ? "near" : `${where.kind}:${where.value}`;
  const hero = variant === "hero";

  return (
    <form onSubmit={submit} role="search" className={hero ? "card p-4 shadow-lg shadow-black/5 sm:p-5" : "card p-3"}>
      <div className={hero ? "grid gap-4 md:grid-cols-[1fr_15rem_auto] md:items-end" : "grid gap-3 md:grid-cols-[1fr_13rem_auto] md:items-end"}>
        {/* Dishes */}
        <div className="relative">
          <label htmlFor={`${listId}-input`} className={hero ? "label text-base" : "label"}>
            {t("dishesLabel")}
          </label>
          <div
            className="input flex min-h-12 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-brand"
            onClick={() => inputRef.current?.focus()}
          >
            {dishes.map((d) => (
              <span key={d} className="chip">
                {d}
                <button
                  type="button"
                  aria-label={t("remove", { dish: d })}
                  className="-mr-1 rounded-full px-1 leading-none hover:bg-brand/15"
                  onClick={() => setDishes((prev) => prev.filter((x) => x !== d))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              id={`${listId}-input`}
              value={text}
              onChange={(e) => {
                const v = e.target.value;
                if (v.includes(",")) v.split(",").slice(0, -1).forEach(addDish);
                setText(v.includes(",") ? v.split(",").at(-1)!.trimStart() : v);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              placeholder={dishes.length ? "" : t("dishesPlaceholder")}
              className="min-w-[8rem] flex-1 bg-transparent py-1 outline-none placeholder:text-muted/80"
              role="combobox"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              aria-describedby={hintId}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          {open && suggestions.length > 0 && (
            <ul id={listId} role="listbox" className="card absolute inset-x-0 top-full z-[1100] mt-1 overflow-hidden py-1 shadow-lg">
              {suggestions.map((s, i) => (
                <li
                  key={s.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addDish(label(s));
                  }}
                  className={`cursor-pointer px-4 py-2 text-sm ${i === active ? "bg-brand-soft text-brand" : "hover:bg-surface-2"}`}
                >
                  <span className="font-medium">{label(s)}</span>{" "}
                  <span className="ml-1 text-xs text-muted">{locale === "en" ? s.name_es : s.name_en}</span>
                </li>
              ))}
            </ul>
          )}
          <p id={hintId} className={error ? "hint text-danger" : hero ? "hint" : "sr-only"}>
            {error ?? t("dishesHint")}
          </p>
        </div>

        {/* Where */}
        <div>
          <label htmlFor={`${listId}-where`} className={hero ? "label text-base" : "label"}>
            {t("whereLabel")}
          </label>
          <select
            id={`${listId}-where`}
            className="input min-h-12"
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "near") return locateMe();
              if (!v) return setWhere({ kind: "all" });
              const [kind, value] = v.split(":");
              setWhere({ kind: kind as "region" | "municipio", value });
            }}
          >
            <option value="">{t("allIsland")}</option>
            <option value="near">📍 {where.kind === "near" ? t("nearMeActive") : t("nearMe")}</option>
            <optgroup label={t("regionsGroup")}>
              {REGIONS.map((r) => (
                <option key={r} value={`region:${r}`}>{tr(r)}</option>
              ))}
            </optgroup>
            <optgroup label={t("municipalitiesGroup")}>
              {municipalities.map((m) => (
                <option key={m.slug} value={`municipio:${m.slug}`}>{m.name}</option>
              ))}
            </optgroup>
          </select>
          {where.kind === "near" ? (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
              <label htmlFor={`${listId}-radius`}>{t("radius")}</label>
              <select
                id={`${listId}-radius`}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                value={where.radio}
                onChange={(e) => setWhere({ ...where, radio: Number(e.target.value) })}
              >
                {RADIUS_OPTIONS.map((km) => (
                  <option key={km} value={km}>{t("radiusKm", { km })}</option>
                ))}
              </select>
            </div>
          ) : geoState !== "idle" ? (
            <p className={`hint ${geoState === "denied" ? "text-danger" : ""}`} role="status">
              {geoState === "locating" ? t("locating") : t("locationDenied")}
            </p>
          ) : null}
        </div>

        <button type="submit" className={`btn-primary min-h-12 ${hero ? "md:mb-5 md:px-8 text-base" : ""}`} disabled={pending}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.4 9.83l3.63 3.64a.75.75 0 1 0 1.06-1.06l-3.63-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
          </svg>
          {t("submit")}
        </button>
      </div>
    </form>
  );
}
