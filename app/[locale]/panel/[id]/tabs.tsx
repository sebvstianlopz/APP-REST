"use client";
import { Link, usePathname } from "@/i18n/routing";

export function PanelTabs({ id, labels }: { id: string; labels: Record<"overview" | "profile" | "menu" | "billing", string> }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/panel/${id}`, label: labels.overview },
    { href: `/panel/${id}/perfil`, label: labels.profile },
    { href: `/panel/${id}/menu`, label: labels.menu },
    { href: `/panel/${id}/membresia`, label: labels.billing },
  ];
  return (
    <nav className="mt-6 -mx-4 overflow-x-auto border-b border-line px-4">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 px-4 py-2.5 text-sm font-semibold ${
                  active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
