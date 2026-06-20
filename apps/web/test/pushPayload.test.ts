import { describe, expect, test } from "bun:test";
import { parsePushPayload } from "../lib/pushPayload";

/**
 * The SW receives FCM pushes as JSON. We send data-only ({title,body,url} at top
 * level), but the parser must also tolerate FCM's notification shape — this is
 * the one payload shape we couldn't verify against the docs, so it's pinned here.
 */

describe("parsePushPayload", () => {
  test("reads our data-only top-level shape", () => {
    expect(parsePushPayload({ title: "Cue", body: "Session soon", url: "/schedule" })).toEqual({
      title: "Cue",
      body: "Session soon",
      url: "/schedule",
    });
  });

  test("reads FCM notification + data.url shape", () => {
    expect(
      parsePushPayload({
        notification: { title: "Room moved", body: "Now in Hall 2" },
        data: { url: "/pulse" },
      }),
    ).toEqual({ title: "Room moved", body: "Now in Hall 2", url: "/pulse" });
  });

  test("reads FCM fcmOptions.link as the url", () => {
    expect(
      parsePushPayload({ notification: { title: "T", body: "B" }, fcmOptions: { link: "/perks" } }),
    ).toEqual({ title: "T", body: "B", url: "/perks" });
  });

  test("falls back to Cue title and / when fields are missing/blank", () => {
    expect(parsePushPayload({})).toEqual({ title: "Cue", body: "", url: "/" });
    expect(parsePushPayload({ title: "" })).toEqual({ title: "Cue", body: "", url: "/" });
    expect(parsePushPayload(null)).toEqual({ title: "Cue", body: "", url: "/" });
  });

  test("top-level shape wins over notification shape when both present", () => {
    expect(
      parsePushPayload({
        title: "Top",
        body: "TopBody",
        url: "/a",
        notification: { title: "Nested", body: "NestedBody" },
        data: { url: "/b" },
      }),
    ).toEqual({ title: "Top", body: "TopBody", url: "/a" });
  });
});
