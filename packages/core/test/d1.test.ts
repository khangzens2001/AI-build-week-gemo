import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { d1Execute, d1Query } from "../src/d1";

/**
 * Verifies the d1.ts dual-target seam against a stub local endpoint (the same
 * contract the bun:sqlite shim implements). No Cloudflare creds are set here, so
 * this also proves the local branch short-circuits before any requireEnv.
 */

const PORT = 8799;
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
  process.env.D1_LOCAL_URL = URL;
  // Ensure remote creds are absent — local branch must not need them. Use delete
  // (not `= undefined`, which coerces to the truthy string "undefined").
  // biome-ignore lint/performance/noDelete: test setup, must truly remove the env var
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  // biome-ignore lint/performance/noDelete: test setup, must truly remove the env var
  delete process.env.CLOUDFLARE_API_TOKEN;
  // biome-ignore lint/performance/noDelete: test setup, must truly remove the env var
  delete process.env.D1_DATABASE_ID;
  server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const body = (await req.json()) as Captured;
      captured.push(body);
      // No auth header should be sent on the local path.
      if (req.headers.get("authorization")) {
        return Response.json({ success: false, errors: [{ message: "unexpected auth" }] });
      }
      return Response.json(nextResponse);
    },
  });
});

afterEach(() => {
  server?.stop(true);
  server = null;
  process.env.D1_LOCAL_URL = undefined;
});

describe("d1 dual-target (local)", () => {
  test("d1Query posts sql+params and returns rows from result[0].results", async () => {
    nextResponse = { success: true, result: [{ results: [{ id: "x" }, { id: "y" }] }] };
    const rows = await d1Query<{ id: string }>("SELECT id FROM t WHERE a = ?", ["v"]);
    expect(rows).toEqual([{ id: "x" }, { id: "y" }]);
    expect(captured[0]).toEqual({ sql: "SELECT id FROM t WHERE a = ?", params: ["v"] });
  });

  test("no Authorization header is sent on the local path", async () => {
    nextResponse = { success: true, result: [{ results: [] }] };
    // (the stub returns an error if it sees an auth header)
    await expect(d1Query("SELECT 1")).resolves.toEqual([]);
  });

  test("success:false surfaces as a thrown error", async () => {
    nextResponse = { success: false, errors: [{ message: "constraint failed" }] };
    await expect(d1Query("INSERT …")).rejects.toThrow(/constraint failed/);
  });

  test("d1Execute resolves on success and ignores rows", async () => {
    nextResponse = { success: true, result: [{ results: [] }] };
    await expect(d1Execute("UPDATE t SET a = ?", [1])).resolves.toBeUndefined();
  });
});
