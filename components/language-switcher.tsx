"use client";
import { useLocale } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Switcher({ label, aria }: { label: string; aria: string }) {
  const locale = useLocale();
  const pathname = usePathname(); // includes the locale prefix, e.g. /es/buscar
  const search = useSearchParams();
  const next = locale === "es" ? "en" : "es";
  const rest = pathname.replace(/^\/(es|en)(?=\/|$)/, "");
  const qs = search.toString();
  const href = `/${next}${rest}${qs ? `?${qs}` : ""}`;

  return (
    <a href={href} hrefLang={next} aria-label={aria} className="btn-ghost px-3 font-semibold text-sea">
      {label}
    </a>
  );
}

export function LanguageSwitcher(props: { label: string; aria: string }) {
  return (
    <Suspense fallback={<span className="btn-ghost px-3 font-semibold text-sea">{props.label}</span>}>
      <Switcher {...props} />
    </Suspense>
  );
}
