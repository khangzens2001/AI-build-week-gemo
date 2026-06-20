/**
 * Whether the dev-only "mock account" sign-in button should be shown.
 *
 * Must mirror `isDevAuthEnabled()` in @event/core (which gates the actual
 * Credentials provider in auth.ts): non-production AND not explicitly disabled.
 * The server flag is CUE_DEV_AUTH; the client reads its NEXT_PUBLIC_ mirror so
 * the button never appears when the provider is absent (tapping it would fail).
 */
export function devAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_CUE_DEV_AUTH !== "0";
}
