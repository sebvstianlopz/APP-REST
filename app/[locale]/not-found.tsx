import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function NotFound() {
  const t = useTranslations("restaurant");
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-5xl" aria-hidden="true">🍽️</p>
      <h1 className="mt-4 font-display text-2xl font-bold">{t("notFound")}</h1>
      <Link href="/" className="btn-primary mt-6">Antojo PR</Link>
    </div>
  );
}
