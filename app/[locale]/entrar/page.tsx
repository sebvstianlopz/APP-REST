import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getUser } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ owner?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await getUser();
  if (user) redirect({ href: "/panel", locale });
  const { owner } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6 sm:p-8">
        <LoginForm ownerDefault={owner === "1"} />
      </div>
    </div>
  );
}
