import { describe, expect, test } from "bun:test";
import { type RawBundleDay, buildVenues, slug } from "../src/seed/transform";

/**
 * Regression guard for the map "only 2 markers" bug (PR-after-#14): the json5
 * schedule parser emits SHORT venue names ("Tasco", "AWS Office"), which slug to
 * ids that must still produce a venue per attended place AND match the venueId
 * sessions derive (also slug(day.venue)). buildVenues is now bundle-first +
 * registry-backed, so this holds regardless of how the parser spells names.
 */

// Mirrors the LIVE bundle shape (short venue names) that broke the map.
const LIVE_BUNDLE: RawBundleDay[] = [
  { day: "01", theme: "Enable", venue: "Tasco", venueImage: "/venues/tasco-office.webp", blocks: [] },
  { day: "02", theme: "Integrate", venue: "AWS Office", venueImage: "/venues/aws-office.webp", blocks: [] },
  { day: "03", theme: "Design", venue: "VNG Campus", venueImage: "/venues/vng-campus.webp", blocks: [] },
  { day: "04", theme: "Build", venue: "Galaxy Innovation Park", venueImage: "/venues/galaxy.webp", blocks: [] },
  { day: "05", theme: "Demo", venue: "Galaxy Innovation Park", venueImage: "/venues/galaxy.webp", blocks: [] },
];

describe("buildVenues (bundle-first + registry)", () => {
  const venues = buildVenues(LIVE_BUNDLE);

  test("yields one venue per distinct day.venue (4, not 2)", () => {
    expect(venues.length).toBe(4);
    expect(venues.map((v) => v.id).sort()).toEqual(
      ["aws-office", "galaxy-innovation-park", "tasco", "vng-campus"].sort(),
    );
  });

  test("venue ids equal slug(day.venue) — the session venueId join key", () => {
    for (const d of LIVE_BUNDLE) {
      expect(venues.some((v) => v.id === slug(d.venue))).toBe(true);
    }
  });

  test("all four curated venues have non-null coords (incl. AWS, absent in crawl)", () => {
    for (const v of venues) {
      expect(v.lat).not.toBeNull();
      expect(v.lng).not.toBeNull();
    }
    const aws = venues.find((v) => v.id === "aws-office");
    expect(aws?.lat).toBeCloseTo(10.7717, 3);
  });

  test("registry supplies the richer canonical name", () => {
    expect(venues.find((v) => v.id === "tasco")?.name).toBe("Tasco Office");
    expect(venues.find((v) => v.id === "aws-office")?.name).toBe("AWS Office, Bitexco Tower");
  });

  test("imageUrl carried from the bundle day", () => {
    expect(venues.find((v) => v.id === "tasco")?.imageUrl).toBe("/venues/tasco-office.webp");
  });

  test("an unregistered venue still appears, with null coords (list-only, no pin)", () => {
    const v = buildVenues([
      { day: "01", theme: "X", venue: "Mystery Hall", blocks: [] },
    ]);
    expect(v.length).toBe(1);
    expect(v[0].id).toBe("mystery-hall");
    expect(v[0].lat).toBeNull();
  });
});
