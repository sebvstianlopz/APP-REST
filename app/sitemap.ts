import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getListedSlugs } from "@/lib/data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const page = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${env.siteUrl}/es${path}`,
    lastModified,
    alternates: { languages: { es: `${env.siteUrl}/es${path}`, en: `${env.siteUrl}/en${path}` } },
  });
  const slugs = env.supabaseUrl ? await getListedSlugs().catch(() => []) : [];
  return [page(""), page("/para-restaurantes"), ...slugs.map((s) => page(`/restaurantes/${s.slug}`, s.updated_at))];
}
