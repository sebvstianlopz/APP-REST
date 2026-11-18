"use client";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/app/[locale]/panel/actions";

/** Inline result message for a server-action form. */
export function FormStatus({ state, okMessage }: { state: ActionState; okMessage?: string }) {
  const t = useTranslations("panel");
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-danger">
        {t("errorGeneric")}
        {state.error !== "generic" && <span className="ml-1 font-normal opacity-80">({state.error})</span>}
      </p>
    );
  }
  if (state.ok) return <p role="status" className="text-sm font-medium text-ok">✓ {okMessage ?? t("saved")}</p>;
  return null;
}
