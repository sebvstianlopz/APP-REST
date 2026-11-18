import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/panel";

export default async function PanelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  return <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>;
}
