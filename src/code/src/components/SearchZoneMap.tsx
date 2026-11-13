import {t, useLanguage} from "../i18n";
import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { isValidCoordinates } from "../utils/geo";
export function SearchZoneMap({
  lat,
  lng,
  radius,
  onSelect,
}: {
  lat: number;
  lng: number;
  radius: number;
  onSelect: (lat: number, lng: number) => void;
}) {
  useLanguage();
  const container = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    marker = useRef<L.Circle | null>(null),
    select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!container.current || !isValidCoordinates(lat, lng)) return;
    const instance = L.map(container.current, {
      center: [lat, lng],
      zoom: 12,
      scrollWheelZoom: false,
    });
    map.current = instance;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(instance);
    marker.current = L.circle([lat, lng], {
      radius: Math.max(
        100,
        Math.min(100000, Number.isFinite(radius) ? radius * 1000 : 3000),
      ),
      color: "#468189",
      fillOpacity: 0.15,
    }).addTo(instance);
    instance.on("click", (e: L.LeafletMouseEvent) =>
      select.current(e.latlng.lat, e.latlng.lng),
    );
    const timer = setTimeout(() => instance.invalidateSize(), 100);
    return () => {
      clearTimeout(timer);
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, [isValidCoordinates(lat, lng)]);
  useEffect(() => {
    if (
      isValidCoordinates(lat, lng) &&
      Number.isFinite(radius) &&
      radius >= 0.1 &&
      radius <= 100
    ) {
      marker.current?.setLatLng([lat, lng]).setRadius(radius * 1000);
      map.current?.panTo([lat, lng]);
    }
  }, [lat, lng, radius]);
  return (
    <div>
      <p className="text-xs text-slate-600 mb-2">{t("Tocá el mapa para elegir el centro. También podés editar las coordenadas con teclado.")}</p>
      <div
        ref={container}
        role="region"
        aria-label={t("Mapa de la zona de búsqueda")}
        className="h-48 rounded-xl relative z-0 border overflow-hidden"
      />
    </div>
  );
}
