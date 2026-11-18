"use client";
import dynamic from "next/dynamic";

const ResultsMap = dynamic(() => import("./results-map"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-surface-2" />,
});

export function RestaurantMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  return <ResultsMap points={[{ id: "r", lat, lng, label: name, rank: 1 }]} className="h-56" zoom={15} />;
}
