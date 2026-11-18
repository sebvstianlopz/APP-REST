"use client";
import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile, uploadCoverPhoto, type ActionState } from "../../actions";
import { FormStatus } from "@/components/form-status";
import { DAYS, type Municipality } from "@/lib/types";
import type { OwnedRestaurant } from "@/lib/panel";

const LocationPicker = dynamic(() => import("@/components/location-picker"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-surface-2" />,
});

export function ProfileForm({ r, municipalities }: { r: OwnedRestaurant; municipalities: Municipality[] }) {
  const t = useTranslations("panel");
  const tp = useTranslations("panel.profile");
  const td = useTranslations("days");
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProfile.bind(null, r.id), {});
  const [loc, setLoc] = useState(r.lat !== null && r.lng !== null ? { lat: r.lat, lng: r.lng } : null);
  const [slug, setSlug] = useState(r.slug);
  const [geo, setGeo] = useState<"idle" | "busy" | "notfound">("idle");

  async function findAddress(form: HTMLFormElement) {
    const address = (form.elements.namedItem("address") as HTMLInputElement).value;
    const mId = (form.elements.namedItem("municipality_id") as HTMLSelectElement).value;
    const town = municipalities.find((m) => String(m.id) === mId)?.name ?? "";
    if (!address && !town) return;
    setGeo("busy");
    try {
      const q = new URLSearchParams({ q: [address, town, "Puerto Rico"].filter(Boolean).join(", "), format: "json", limit: "1", countrycodes: "pr" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { Accept: "application/json" } });
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (hit) {
        setLoc({ lat: Number(Number(hit.lat).toFixed(6)), lng: Number(Number(hit.lon).toFixed(6)) });
        setGeo("idle");
      } else setGeo("notfound");
    } catch {
      setGeo("notfound");
    }
  }

  return (
    <div className="space-y-6">
      <PhotoForm id={r.id} />

      <form action={action} className="card space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tp("name")} htmlFor="name">
            <input id="name" name="name" defaultValue={r.name} required minLength={2} maxLength={120} className="input" />
          </Field>
          <Field label={tp("slug")} htmlFor="slug" hint={tp("slugHint", { slug })}>
            <input id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} className="input" />
          </Field>
          <Field label={tp("descriptionEs")} htmlFor="description_es" className="sm:col-span-2">
            <textarea id="description_es" name="description_es" defaultValue={r.description_es ?? ""} rows={3} maxLength={600} className="input" />
          </Field>
          <Field label={tp("descriptionEn")} htmlFor="description_en" className="sm:col-span-2">
            <textarea id="description_en" name="description_en" defaultValue={r.description_en ?? ""} rows={2} maxLength={600} className="input" />
          </Field>
          <Field label={tp("address")} htmlFor="address">
            <input id="address" name="address" defaultValue={r.address ?? ""} maxLength={200} className="input" autoComplete="street-address" />
          </Field>
          <Field label={tp("municipality")} htmlFor="municipality_id">
            <select id="municipality_id" name="municipality_id" defaultValue={r.municipality_id ?? ""} className="input">
              <option value="">{tp("chooseMunicipality")}</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset>
          <legend className="label">{tp("location")}</legend>
          <p className="hint mb-2 mt-0">{tp("locationHint")}</p>
          <button type="button" className="btn-secondary mb-2" disabled={geo === "busy"} onClick={(e) => findAddress(e.currentTarget.form!)}>
            {tp("findAddress")}
          </button>
          {geo === "notfound" && <p className="mb-2 text-sm text-warn" role="status">{tp("addressNotFound")}</p>}
          <LocationPicker value={loc} onChange={setLoc} />
          <input type="hidden" name="lat" value={loc?.lat ?? ""} />
          <input type="hidden" name="lng" value={loc?.lng ?? ""} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tp("phone")} htmlFor="phone">
            <input id="phone" name="phone" type="tel" defaultValue={r.phone ?? ""} maxLength={30} className="input" autoComplete="tel" />
          </Field>
          <Field label={tp("website")} htmlFor="website">
            <input id="website" name="website" defaultValue={r.website ?? ""} maxLength={300} className="input" inputMode="url" />
          </Field>
          <Field label={tp("priceRange")} htmlFor="price_range">
            <select id="price_range" name="price_range" defaultValue={r.price_range ?? ""} className="input">
              <option value="">—</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{"$".repeat(n)}</option>
              ))}
            </select>
          </Field>
          <Field label={tp("cuisineTags")} htmlFor="cuisine_tags" hint={tp("cuisineTagsHint")}>
            <input id="cuisine_tags" name="cuisine_tags" defaultValue={r.cuisine_tags.join(", ")} maxLength={300} className="input" />
          </Field>
        </div>

        <fieldset>
          <legend className="label">{tp("hours")}</legend>
          <p className="hint mb-2 mt-0">{tp("hoursHint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {DAYS.map((d) => (
              <label key={d} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-muted">{td(d)}</span>
                <input name={`hours_${d}`} defaultValue={r.hours?.[d] ?? ""} placeholder="11:00-20:00" className="input py-2" />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-4">
          <button className="btn-primary" disabled={pending}>{t("save")}</button>
          <FormStatus state={state} />
        </div>
      </form>
    </div>
  );
}

function PhotoForm({ id }: { id: string }) {
  const tp = useTranslations("panel.profile");
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadCoverPhoto.bind(null, id), {});
  return (
    <form action={action} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:p-6">
      <div className="flex-1">
        <label htmlFor="photo" className="label">{tp("coverPhoto")}</label>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:font-semibold file:text-brand" />
        <p className="hint">{tp("coverPhotoHint")}</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-secondary" disabled={pending}>{tp("uploadPhoto")}</button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
