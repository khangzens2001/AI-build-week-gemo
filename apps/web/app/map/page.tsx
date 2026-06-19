"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { PinIcon } from "@/components/icons";
import { VenueRow } from "@/components/map/VenueRow";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useVenues } from "@/hooks/useEventData";

// MapLibre touches window — load the map purely on the client.
const VenueMap = dynamic(() => import("@/components/map/VenueMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" aria-hidden />,
});

export default function MapPage() {
  const { data, isLoading, isError, refetch } = useVenues();
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const venues = data?.venues ?? [];
  const withCoords = useMemo(() => venues.filter((v) => v.lat != null && v.lng != null), [venues]);
  const withoutCoords = useMemo(
    () => venues.filter((v) => v.lat == null || v.lng == null),
    [venues],
  );

  return (
    <div className="px-4">
      <header className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Get around
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Venues</h1>
      </header>

      {isError ? (
        <ErrorState message="Couldn't load venues." onRetry={() => refetch()} />
      ) : (
        <>
          {/* Map canvas — explicit height is required for Leaflet. */}
          <div className="relative h-[42dvh] overflow-hidden rounded-3xl border border-line bg-surface">
            {isLoading ? (
              <div className="skeleton h-full w-full" aria-hidden />
            ) : withCoords.length > 0 ? (
              <VenueMap venues={withCoords} activeId={activeId} onSelect={setActiveId} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
                Venue locations are being confirmed.
              </div>
            )}
          </div>

          {/* Venue list */}
          <div ref={listRef} className="mt-4 space-y-2.5">
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[68px] rounded-2xl" aria-hidden />
              ))
            ) : venues.length === 0 ? (
              <EmptyState
                icon={<PinIcon className="h-6 w-6" />}
                title="No venues yet"
                description="Locations will appear here once confirmed."
              />
            ) : (
              <>
                {withCoords.map((v) => (
                  <VenueRow
                    key={v.id}
                    venue={v}
                    active={activeId === v.id}
                    onSelect={setActiveId}
                  />
                ))}
                {withoutCoords.length > 0 && (
                  <>
                    <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
                      Location TBC
                    </p>
                    {withoutCoords.map((v) => (
                      <VenueRow key={v.id} venue={v} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
