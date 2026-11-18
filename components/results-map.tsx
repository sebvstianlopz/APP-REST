"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
  rank?: number;
}

const PR_BOUNDS: L.LatLngBoundsExpression = [
  [17.85, -67.3],
  [18.55, -65.2],
];

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Lightweight Leaflet map. Pins are numbered to match the result list. */
export default function ResultsMap({
  points,
  me,
  className = "h-[60vh] min-h-80",
  zoom,
}: {
  points: MapPoint[];
  me?: { lat: number; lng: number } | null;
  className?: string;
  zoom?: number;
}) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const latlngs: L.LatLngExpression[] = [];
    points.forEach((p, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin"><span>${p.rank ?? i + 1}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28],
      });
      const m = L.marker([p.lat, p.lng], { icon, title: p.label, alt: p.label }).addTo(map);
      m.bindPopup(p.href ? `<a href="${esc(p.href)}"><strong>${esc(p.label)}</strong></a>` : `<strong>${esc(p.label)}</strong>`);
      latlngs.push([p.lat, p.lng]);
    });
    if (me) {
      L.marker([me.lat, me.lng], {
        icon: L.divIcon({ className: "", html: '<div class="pin-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: false,
      }).addTo(map);
      latlngs.push([me.lat, me.lng]);
    }

    if (latlngs.length === 1) map.setView(latlngs[0], zoom ?? 15);
    else if (latlngs.length > 1) map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 14 });
    else map.fitBounds(PR_BOUNDS);

    // The map may start inside a hidden tab (mobile); re-measure when shown.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);

    return () => {
      ro.disconnect();
      map.remove();
    };
  }, [points, me, zoom]);

  return <div ref={el} className={`w-full overflow-hidden rounded-2xl border border-line ${className}`} />;
}
