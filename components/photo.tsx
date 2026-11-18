/* eslint-disable @next/next/no-img-element -- Supabase Storage URLs are already sized; avoid image-optimizer config */
import { photoUrl } from "@/lib/storage";

export function Photo({ path, alt, name, className = "" }: { path: string | null; alt: string; name: string; className?: string }) {
  const src = photoUrl(path);
  if (src) return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
  const initials = name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w) && w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      role="img"
      aria-label={alt}
      className={`grid place-items-center bg-[linear-gradient(135deg,var(--brand-soft),var(--sea-soft))] font-display text-2xl font-bold text-brand ${className}`}
    >
      {initials || "🍽"}
    </div>
  );
}
