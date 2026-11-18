"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { MapPoint } from "./results-map";

const ResultsMap = dynamic(() => import("./results-map"), {
  ssr: false,
  loading: () => <div className="h-[60vh] min-h-80 animate-pulse rounded-2xl bg-surface-2" />,
});

/**
 * Mobile: list/map toggle. Desktop: list and sticky map side by side.
 * The list itself is server-rendered and passed in as children.
 */
export function ResultsView({
  children,
  points,
  me,
  labels,
}: {
  children: React.ReactNode;
  points: MapPoint[];
  me: { lat: number; lng: number } | null;
  labels: { list: string; map: string };
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const tab = (v: "list" | "map", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      onClick={() => setView(v)}
      className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold ${view === v ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div role="tablist" className="mb-4 flex rounded-full bg-surface-2 p-1 lg:hidden">
        {tab("list", labels.list)}
        {tab("map", labels.map)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={view === "map" ? "hidden lg:block" : ""}>{children}</div>
        <div className={view === "list" ? "hidden lg:block" : ""}>
          <div className="lg:sticky lg:top-20">
            <ResultsMap points={points} me={me} className="h-[70vh] min-h-80 lg:h-[calc(100dvh-7rem)]" />
          </div>
        </div>
      </div>
    </>
  );
}
