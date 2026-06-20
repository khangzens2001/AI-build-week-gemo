"use client";

import { cn } from "@/lib/cn";
import type { PushPermission } from "@/lib/push";
import { BellIcon, CheckIcon } from "../icons";
import { Sheet } from "../ui/Sheet";

/**
 * Soft-ask bottom sheet for push notifications. Renders different content per
 * `permission` state — the friendly pre-prompt ("default"), an unblock guide
 * ("denied", where the native prompt can no longer be shown), and a minimal
 * confirming fallback ("granted"/"unsupported") so the component is total.
 * The parent owns the actual Notification.requestPermission + token register
 * via `onEnable`, and controls open-state.
 */
export function NotificationPermissionDrawer({
  open,
  permission,
  reason,
  busy,
  onEnable,
  onClose,
}: {
  open: boolean;
  permission: PushPermission;
  reason?: string;
  busy: boolean;
  onEnable: () => void;
  onClose: () => void;
}) {
  // Eyebrow + headline shown in Sheet's title slot, varies by state.
  const eyebrow =
    permission === "denied"
      ? "Notifications blocked"
      : permission === "granted"
        ? "All set"
        : "Stay in the loop";

  const headline =
    permission === "denied"
      ? "Re-enable in your browser"
      : permission === "granted"
        ? "Notifications are on"
        : "Turn on notifications";

  const subline =
    permission === "denied"
      ? "You turned these off before, so we can't ask again from here."
      : permission === "granted"
        ? "You're all set to get reminders and live updates."
        : reason
          ? `We'll let you know ${reason}.`
          : "Get reminders for sessions, deadlines, and live updates.";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div>
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-text">
            <BellIcon className="h-6 w-6" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
            {eyebrow}
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight">{headline}</h2>
          <p className="mt-1 text-sm text-muted">{subline}</p>
        </div>
      }
      footer={
        permission === "default" ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onEnable}
              disabled={busy}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-[15px] font-bold text-accent-ink transition active:scale-[0.98]",
                "disabled:opacity-60",
              )}
            >
              {busy ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink"
                    aria-hidden
                  />
                  Enabling…
                </>
              ) : (
                <>
                  <BellIcon className="h-4 w-4" />
                  Enable notifications
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-full rounded-2xl bg-surface-2 py-3 text-[15px] font-semibold text-muted ring-1 ring-line transition active:scale-[0.98] disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-surface-2 py-3 text-[15px] font-semibold text-muted ring-1 ring-line transition active:scale-[0.98]"
            >
              {permission === "denied" ? "Got it" : "Done"}
            </button>
          </div>
        )
      }
    >
      {permission === "default" && (
        <div className="space-y-3 py-2">
          {DEFAULT_POINTS.map(({ title, body }) => (
            <div key={title} className="flex gap-3.5 rounded-2xl bg-surface-2 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
                <CheckIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{title}</p>
                <p className="mt-0.5 text-sm leading-snug text-muted">{body}</p>
              </div>
            </div>
          ))}
          <p className="px-1 pt-1 text-center text-xs text-faint">
            We only ping you about things you've asked to follow. Turn it off any time.
          </p>
        </div>
      )}

      {permission === "denied" && (
        <div className="space-y-3 py-2">
          <p className="px-1 text-sm leading-snug text-muted">
            To get reminders again, allow notifications for this site in your browser:
          </p>
          <ol className="space-y-2">
            {UNBLOCK_STEPS.map((step, i) => (
              <li key={step} className="flex gap-3.5 rounded-2xl bg-surface-2 p-3.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/12 text-[13px] font-bold text-accent-text">
                  {i + 1}
                </div>
                <p className="min-w-0 pt-0.5 text-sm leading-snug text-muted">{step}</p>
              </li>
            ))}
          </ol>
          <p className="px-1 pt-1 text-center text-xs text-faint">
            Once you've allowed it, come back and set a reminder.
          </p>
        </div>
      )}

      {(permission === "granted" || permission === "unsupported") && (
        <div className="py-2">
          <p className="px-1 text-sm leading-snug text-muted">
            {permission === "granted"
              ? "Nothing else to do here — reminders and live updates will reach you on this device."
              : "Notifications aren't available on this device or browser, but everything else in Cue still works."}
          </p>
        </div>
      )}
    </Sheet>
  );
}

const DEFAULT_POINTS = [
  {
    title: "Session reminders",
    body: "A nudge 15 minutes before talks and workshops you're following.",
  },
  {
    title: "Deadline alerts",
    body: "Heads-up before submissions and check-ins close.",
  },
  {
    title: "Live updates",
    body: "Room changes and last-minute schedule shifts, the moment they happen.",
  },
];

const UNBLOCK_STEPS = [
  "Tap the lock or site-settings icon in your browser's address bar.",
  "Find Notifications and switch it to Allow.",
  "Reload Cue so the change takes effect.",
];
