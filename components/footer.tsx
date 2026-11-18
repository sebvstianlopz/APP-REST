import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export async function Footer() {
  const t = await getTranslations("footer");
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t("rights", { year: new Date().getFullYear() })}</p>
        <Link href="/para-restaurantes" className="font-medium text-sea hover:underline">
          {t("forRestaurants")}
        </Link>
      </div>
    </footer>
  );
}
