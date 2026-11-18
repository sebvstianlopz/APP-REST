export type Region = "metro" | "norte" | "sur" | "este" | "oeste" | "centro";
export const REGIONS: Region[] = ["metro", "norte", "sur", "este", "oeste", "centro"];

export type RestaurantStatus = "draft" | "pending_review" | "active" | "suspended";

export interface Municipality {
  id: number;
  slug: string;
  name: string;
  region: Region;
}

export interface MatchedItem {
  id: string;
  name: string;
  price: number | null;
  term: string;
  position: number;
}

export interface SearchResult {
  restaurant_id: string;
  slug: string;
  name: string;
  municipality: string | null;
  region: Region | null;
  address: string | null;
  price_range: number | null;
  cuisine_tags: string[];
  cover_photo_path: string | null;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
  requested_count: number;
  match_count: number;
  matched_terms: string[];
  matched_items: MatchedItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  is_available: boolean;
  dish_id: number | null;
}

export type Hours = Partial<Record<Day, string>>;
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export interface RestaurantDetail {
  id: string;
  slug: string;
  name: string;
  description_es: string | null;
  description_en: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: Hours;
  price_range: number | null;
  cuisine_tags: string[];
  cover_photo_path: string | null;
  status: RestaurantStatus;
  is_listed: boolean;
  lat: number | null;
  lng: number | null;
  municipality: Municipality | null;
  menu: MenuItem[];
}
