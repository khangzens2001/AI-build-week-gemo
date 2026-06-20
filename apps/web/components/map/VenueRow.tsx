"use client";

import { cn } from "@/lib/cn";
import type { Venue } from "@/lib/types";
import Image from "next/image";
import { useState } from "react";
import { ExternalIcon, PinIcon } from "../icons";

/**
 * A venue list row. Venues with coords are tappable to fly the map to them;
 * those without coords still link out to Google Maps where available.
 */
export function VenueRow({
  venue,
  onSelect,
  active,
}: {
  venue: Venue;
  onSelect?: (id: string) => void;
  active?: boolean;
}) {
  const hasCoords = venue.lat != null && venue.lng != null;
  const [imgOk, setImgOk] = useState(true);
  const showImage = Boolean(venue.imageUrl) && imgOk;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3.5 transition",
        active ? "border-accent/40 bg-accent/[0.06]" : "border-line bg-surface",
      )}
    >
      <button
        type="button"
        onClick={() => hasCoords && onSelect?.(venue.id)}
        disabled={!hasCoords}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {showImage && venue.imageUrl ? (
          <span
            className={cn(
              "relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1",
              active ? "ring-accent/40" : "ring-line",
            )}
          >
            <Image
              src={venue.imageUrl}
              alt=""
              fill
              // The thumbnail renders at 48px CSS; request 96px so it stays
              // crisp on 2× retina displays (a 48px candidate looked blurry).
              sizes="96px"
              quality={90}
              onError={() => setImgOk(false)}
              className="object-cover"
            />
          </span>
        ) : (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              hasCoords ? "bg-accent/12 text-accent-text" : "bg-surface-2 text-faint",
            )}
          >
            <PinIcon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{venue.name}</p>
          {venue.address && <p className="truncate text-xs text-faint">{venue.address}</p>}
          {!hasCoords && (
            <p className="text-[11px] font-medium text-faint">Location to be confirmed</p>
          )}
        </div>
      </button>

      {venue.mapUrl && (
        <a
          href={venue.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${venue.name} in Google Maps`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted transition active:scale-90"
        >
          <ExternalIcon className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
