import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { allPushTokens, deletePushToken, dueNotifications, savePushToken } from "../src/userdata";

/**
 * Verifies the FCM push-token data layer against a stub local endpoint (the same
 * `{ sql, params } → { success, result:[{ results }] }` contract the bun:sqlite
 * shim implements). We assert the SQL SHAPE the helpers emit — the upsert's
 * user_id reassign, the dueNotifications JOIN onto push_tokens, etc. — without a
 * real DB, mirroring d1.test.ts.
 */

const PORT = 8801;
const URL = `http://localhost:${PORT}/query`;

interface Captured {
  sql: string;
  params: unknown[];
}
let captured: Captured[] = [];
let nextResponse: unknown = { success: true, result: [{ results: [] }] };
let server: ReturnType<typeof Bun.serve> | null = null;

beforeEach(() => {
  captured = [];
  nextResponse = { success: true, result: [{ results: [] }] };
  process.env.D1_LOCAL_URL = URL;
  server = Bun.serve({
    port: PORT,
    async fetch(req) {
      captured.push((await req.json()) as Captured);
      return Response.json(nextResponse);
    },
  });
});

afterEach(() => {
  server?.stop(true);
  server = null;
  process.env.D1_LOCAL_URL = undefined;
});

describe("savePushToken", () => {
  test("upserts on token and reassigns user_id + last_seen on conflict", async () => {
    await savePushToken({ userId: "u1", token: "tok-abc" });
    const { sql, params } = captured[0];
    expect(sql).toContain("INSERT INTO push_tokens");
    expect(sql).toContain("ON CONFLICT(token) DO UPDATE SET");
    // The reassign is the demo-critical bit (shared device / account switch).
    expect(sql).toContain("user_id = excluded.user_id");
    expect(sql).toContain("last_seen = excluded.last_seen");
    // params: [id, userId, token, created_at, last_seen]
    expect(params[1]).toBe("u1");
    expect(params[2]).toBe("tok-abc");
  });
});

describe("deletePushToken", () => {
  test("deletes by token", async () => {
    await deletePushToken("tok-dead");
    expect(captured[0].sql).toBe("DELETE FROM push_tokens WHERE token = ?");
    expect(captured[0].params).toEqual(["tok-dead"]);
  });
});

describe("allPushTokens", () => {
  test("returns a flat string[] of tokens", async () => {
    nextResponse = {
      success: true,
      result: [{ results: [{ token: "t1" }, { token: "t2" }] }],
    };
    await expect(allPushTokens()).resolves.toEqual(["t1", "t2"]);
    expect(captured[0].sql).toBe("SELECT token FROM push_tokens");
  });
});

describe("dueNotifications", () => {
  test("JOINs push_tokens and selects {kind,source_id,label,token} for both arms", async () => {
    const now = 1_783_490_400_000;
    nextResponse = {
      success: true,
      result: [
        {
          results: [
            { kind: "reminder", source_id: "r1", label: "Session soon", token: "t1" },
            { kind: "checklist", source_id: "c1", label: "Submit demo", token: "t1" },
          ],
        },
      ],
    };
    const due = await dueNotifications(now);
    expect(due).toHaveLength(2);
    expect(due[0]).toEqual({
      kind: "reminder",
      source_id: "r1",
      label: "Session soon",
      token: "t1",
    });

    const { sql, params } = captured[0];
    // Joins the new token table (not the dead push_subscriptions), both arms.
    expect(sql).toContain("JOIN push_tokens t ON t.user_id = r.user_id");
    expect(sql).toContain("JOIN push_tokens t ON t.user_id = c.user_id");
    expect(sql).not.toContain("push_subscriptions");
    expect(sql).toContain("UNION ALL");
    expect(params).toEqual([now, now]);
  });
});
