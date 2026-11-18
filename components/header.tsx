import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getProfile } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { LogoMark } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { signOut } from "@/app/[locale]/entrar/actions";

export async function Header() {
  const t = await getTranslations("nav");
  const tb = await getTranslations("brand");
  const { user, profile } = env.supabaseUrl ? await getProfile() : { user: null, profile: null };

  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <LogoMark />
          <span>{tb("name")}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/para-restaurantes" className="btn-ghost hidden px-3 sm:inline-flex">
            {t("forRestaurants")}
          </Link>
          {profile?.role === "admin" && (
            <Link href="/admin" className="btn-ghost px-3">{t("admin")}</Link>
          )}
          {user ? (
            <>
              <Link href="/panel" className="btn-ghost px-3">{t("dashboard")}</Link>
              <form action={signOut}>
                <button className="btn-ghost px-3 text-muted">{t("logout")}</button>
              </form>
            </>
          ) : (
            <Link href="/entrar" className="btn-secondary px-4 py-2">{t("login")}</Link>
          )}
          <LanguageSwitcher label={t("switchLanguage")} aria={t("switchLanguageLabel")} />
        </nav>
      </div>
    </header>
  );
}
