"use server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect as nextRedirect } from "next/navigation";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export type MagicLinkState = { status: "idle" | "sent" | "error" };

const schema = z.object({
  email: z.email(),
  fullName: z.string().trim().max(80).optional(),
  owner: z.enum(["1", "0"]).optional(),
});

export async function sendMagicLink(_: MagicLinkState, form: FormData): Promise<MagicLinkState> {
  const parsed = schema.safeParse({
    email: form.get("email"),
    fullName: form.get("fullName") || undefined,
    owner: form.get("owner") || undefined,
  });
  if (!parsed.success) return { status: "error" };
  const locale = await getLocale();
  const supabase = await createClient();
  const next = `/${locale}/panel`;
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      // Only applied on first sign-up; the DB trigger never grants more than "owner".
      data: { role: parsed.data.owner === "1" ? "owner" : "diner", full_name: parsed.data.fullName, locale },
    },
  });
  return { status: error ? "error" : "sent" };
}

export async function signInWithGoogle() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(`/${locale}/panel`)}` },
  });
  if (error || !data.url) return redirect({ href: "/entrar?error=1", locale });
  nextRedirect(data.url);
}

export async function signOut() {
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/", locale });
}
