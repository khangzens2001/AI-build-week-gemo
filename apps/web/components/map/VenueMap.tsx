"use client";

import type { Venue } from "@/lib/types";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

/**
 * 3D venue map (MapLibre GL + OpenFreeMap vector tiles — free, no API key).
 * Client-only (imported via next/dynamic with ssr:false). A tilted camera plus
 * an extruded `building` layer gives a real 3D cityscape; the active venue gets
 * a pulsing, raised highlight marker. We build everything imperatively to avoid
 * a react wrapper that isn't in deps.
 */

const HCMC: [number, number] = [106.6297, 10.8231];
// OpenFreeMap "liberty" style: free vector tiles, includes building heights.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function pinElement(active: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = active ? "vm-pin vm-pin--active" : "vm-pin";
  wrap.innerHTML = `
    <span class="vm-pin__dot"></span>
    ${active ? '<span class="vm-pin__ring"></span>' : ""}
  `;
  return wrap;
}

export default function VenueMap({
  venues,
  activeId,
  onSelect,
}: {
  venues: Venue[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const loadedRef = useRef(false);

  // Init the map once.
  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    const pts = venues.filter((v) => v.lat != null && v.lng != null);
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE_URL,
      center: pts[0] ? [pts[0].lng as number, pts[0].lat as number] : HCMC,
      zoom: 12,
      pitch: 55, // tilt for the 3D view
      bearing: -18,
      attributionControl: { compact: true },
      // Direct scroll/pinch zoom (no ⌘ modifier) so users can freely zoom in to
      // the zoom levels where the 3D buildings render. The map lives on its own
      // tab, so capturing scroll-to-zoom is the expected behaviour.
      scrollZoom: true,
      // A roomier zoom range so the cityscape can be explored close-up.
      minZoom: 3,
      maxZoom: 19,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      loadedRef.current = true;

      // Extrude OSM buildings for the 3D cityscape. The liberty style ships a
      // vector "openmaptiles" source with a `building` layer carrying render_height.
      if (!map.getLayer("vm-3d-buildings")) {
        const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
        map.addLayer(
          {
            id: "vm-3d-buildings",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#2a2a36",
              // Fade the extrusions in as you zoom past 14 so they don't pop.
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14,
                0,
                15.5,
                ["coalesce", ["get", "render_height"], 10],
              ],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.85,
            },
          },
          firstSymbol,
        );
      }

      // Place markers + fit once the style is ready.
      placeMarkers();
      fit();
    });

    function placeMarkers() {
      for (const v of pts) {
        const el = pinElement(v.id === activeId);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect?.(v.id);
        });
        const popup = new maplibregl.Popup({ offset: 24, closeButton: true }).setHTML(
          `<div class="vm-popup">
             <p class="vm-popup__name">${v.name}</p>
             ${v.address ? `<p class="vm-popup__addr">${v.address}</p>` : ""}
             ${
               v.mapUrl
                 ? `<a class="vm-popup__link" href="${v.mapUrl}" target="_blank" rel="noopener noreferrer">Open in Google Maps →</a>`
                 : ""
             }
           </div>`,
        );
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([v.lng as number, v.lat as number])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.set(v.id, marker);
      }
    }

    function fit() {
      if (pts.length > 1) {
        const b = new maplibregl.LngLatBounds();
        for (const v of pts) b.extend([v.lng as number, v.lat as number]);
        // fitBounds frames the pins but flattens pitch — re-apply the tilt once
        // the camera settles so the 3D view always reads as 3D.
        map.fitBounds(b, { padding: 70, maxZoom: 14.5, bearing: -18 });
        map.once("moveend", () => map.easeTo({ pitch: 52, bearing: -18, duration: 600 }));
      } else if (pts[0]) {
        map.easeTo({
          center: [pts[0].lng as number, pts[0].lat as number],
          zoom: 15.5,
          pitch: 58,
          bearing: -18,
        });
      }
    }

    return () => {
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [venues, activeId, onSelect]);

  // React to the externally-selected venue: swap marker styling + fly to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const [id, marker] of markersRef.current) {
      const isActive = id === activeId;
      const el = marker.getElement();
      el.className = isActive ? "vm-pin vm-pin--active" : "vm-pin";
      el.innerHTML = `<span class="vm-pin__dot"></span>${
        isActive ? '<span class="vm-pin__ring"></span>' : ""
      }`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect?.(id);
      });
    }

    if (activeId) {
      const v = venues.find((x) => x.id === activeId);
      if (v?.lat != null && v?.lng != null) {
        map.flyTo({ center: [v.lng, v.lat], zoom: 16, pitch: 60, speed: 0.9, essential: true });
        markersRef.current.get(activeId)?.togglePopup();
      }
    }
  }, [activeId, venues, onSelect]);

  return <div ref={ref} className="h-full w-full" aria-label="3D map of event venues" />;
}
