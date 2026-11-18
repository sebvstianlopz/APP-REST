"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { sendMagicLink, signInWithGoogle, type MagicLinkState } from "./actions";

export function LoginForm({ ownerDefault }: { ownerDefault: boolean }) {
  const t = useTranslations("auth");
  const [owner, setOwner] = useState(ownerDefault);
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <p className="rounded-xl bg-ok-soft p-4 font-medium text-ok" role="status">
        ✉️ {t("sent")}
      </p>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{owner ? t("ownerTitle") : t("title")}</h1>
      <p className="mt-2 text-muted">{t("subtitle")}</p>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="owner" value={owner ? "1" : "0"} />
        {owner && (
          <div>
            <label htmlFor="fullName" className="label">{t("name")}</label>
            <input id="fullName" name="fullName" className="input" autoComplete="name" maxLength={80} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">{t("email")}</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" inputMode="email" />
        </div>
        {state.status === "error" && (
          <p className="text-sm text-danger" role="alert">{t("error")}</p>
        )}
        <button className="btn-primary w-full" disabled={pending}>{t("send")}</button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        {t("or")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <form action={signInWithGoogle}>
        <button className="btn-secondary w-full">{t("google")}</button>
      </form>

      <button type="button" onClick={() => setOwner(!owner)} className="mt-6 text-sm font-medium text-sea hover:underline">
        {owner ? t("dinerSwitch") : t("ownerSwitch")}
      </button>
    </div>
  );
}
