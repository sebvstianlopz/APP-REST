import { setRequestLocale } from "next-intl/server";
import { getManagedRestaurant } from "@/lib/panel";
import { getMunicipalities } from "@/lib/data";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [r, municipalities] = await Promise.all([getManagedRestaurant(locale, id), getMunicipalities()]);
  return <ProfileForm r={r} municipalities={municipalities} />;
}
