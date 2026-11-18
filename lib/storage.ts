import { env } from "./env";

export const PHOTO_BUCKET = "restaurant-photos";

export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${env.supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}
