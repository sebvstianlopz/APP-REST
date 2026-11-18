"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createRestaurant, type ActionState } from "./actions";
import { FormStatus } from "@/components/form-status";
import type { Municipality } from "@/lib/types";

export function CreateRestaurantForm({ municipalities }: { municipalities: Municipality[] }) {
  const t = useTranslations("panel");
  const [state, action, pending] = useActionState<ActionState, FormData>(createRestaurant, {});
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold">{t("createTitle")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">{t("profile.name")}</label>
          <input id="name" name="name" required minLength={2} maxLength={120} className="input" />
        </div>
        <div>
          <label htmlFor="municipality_id" className="label">{t("profile.municipality")}</label>
          <select id="municipality_id" name="municipality_id" className="input" defaultValue="">
            <option value="" disabled>{t("profile.chooseMunicipality")}</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>
      <FormStatus state={state} />
      <button className="btn-primary" disabled={pending}>{t("createButton")}</button>
    </form>
  );
}
