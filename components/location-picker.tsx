"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PR_CENTER: L.LatLngTuple = [18.22, -66.45];

/** Map with a draggable pin. Calls onChange when the owner moves it. */
export default function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false }).setView(PR_CENTER, 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const icon = L.divIcon({ className: "", html: '<div class="pin"><span>●</span></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
    const marker = L.marker(PR_CENTER, { draggable: true, icon, autoPan: true });
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onChangeRef.current({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 });
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng).addTo(map);
      onChangeRef.current({ lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 });
    });
    mapRef.current = map;
    markerRef.current = marker;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !value) return;
    marker.setLatLng([value.lat, value.lng]).addTo(map);
    if (!map.getBounds().contains([value.lat, value.lng]) || map.getZoom() < 14) map.setView([value.lat, value.lng], 17);
  }, [value]);

  return <div ref={el} className="h-72 w-full overflow-hidden rounded-xl border border-line" />;
}
