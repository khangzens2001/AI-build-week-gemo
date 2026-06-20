"use client";

import { type PushPermission, enablePush, readPushPermission, registerPushToken } from "@/lib/push";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NotificationPermissionDrawer } from "./NotificationPermissionDrawer";

/**
 * Cross-component push-permission trigger. Any feature that creates a
 * notification-backed thing (reminders, checklist with a time, office-hours
 * booking) calls `requestPushPermission(reason)`:
 *  - permission "granted"  → no-op (already enabled)
 *  - permission "default"  → opens the soft-ask drawer (native prompt fires when
 *                            the user taps Enable inside it — a real user gesture)
 *  - permission "denied"   → opens the drawer in "how to unblock" mode
 *  - "unsupported"         → no-op (no Push API / Firebase not configured)
 */

interface PushPermissionContextValue {
  permission: PushPermission;
  requestPushPermission: (reason?: string) => void;
}

const PushPermissionContext = createContext<PushPermissionContextValue | null>(null);

export function PushPermissionProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  // Read the real permission on mount (client-only). If it's already granted,
  // quietly (re)register the FCM token — this closes the gap where a user who
  // granted in a PRIOR session (or unblocked via browser settings, or whose FCM
  // token rotated) would otherwise have NO token row and silently get no pushes.
  // Token-only (no requestPermission), so it's safe outside a user gesture.
  useEffect(() => {
    const current = readPushPermission();
    setPermission(current);
    if (current === "granted") void registerPushToken();
  }, []);

  const requestPushPermission = useCallback((nextReason?: string) => {
    const current = readPushPermission();
    setPermission(current);
    if (current === "granted" || current === "unsupported") return;
    setReason(nextReason);
    setOpen(true);
  }, []);

  const onEnable = useCallback(async () => {
    setBusy(true);
    try {
      const result = await enablePush();
      setPermission(result);
      // Close on a terminal outcome; keep open on "denied" so the unblock help shows.
      if (result === "granted" || result === "unsupported") setOpen(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({ permission, requestPushPermission }),
    [permission, requestPushPermission],
  );

  return (
    <PushPermissionContext.Provider value={value}>
      {children}
      <NotificationPermissionDrawer
        open={open}
        permission={permission}
        reason={reason}
        busy={busy}
        onEnable={onEnable}
        onClose={() => {
          setOpen(false);
          setReason(undefined);
        }}
      />
    </PushPermissionContext.Provider>
  );
}

export function usePushPermission(): PushPermissionContextValue {
  const ctx = useContext(PushPermissionContext);
  if (!ctx) {
    throw new Error("usePushPermission must be used within <PushPermissionProvider>");
  }
  return ctx;
}
