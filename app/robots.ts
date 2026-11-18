import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/es/panel", "/en/panel", "/es/admin", "/en/admin"] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
