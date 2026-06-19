"use client";

import { usePathname } from "next/navigation";
import { Onboarding } from "../onboarding/Onboarding";
import { AppBar } from "./AppBar";
import { TabBar } from "./TabBar";

/**
 * The mobile app frame: fixed top bar, scrollable content constrained to a
 * phone-width column, and a fixed bottom tab bar. Chat opts out of page scroll
 * (it manages its own), so we give it a fixed-height viewport instead.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname === "/chat";

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col">
      <AppBar />

      {isChat ? (
        <main
          className="flex flex-col overflow-hidden"
          style={{
            paddingTop: "calc(var(--appbar-h) + env(safe-area-inset-top))",
            height: "100dvh",
          }}
        >
          {children}
        </main>
      ) : (
        <main
          className="flex-1"
          style={{
            paddingTop: "calc(var(--appbar-h) + env(safe-area-inset-top) + 0.5rem)",
            paddingBottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 1.5rem)",
          }}
        >
          {children}
        </main>
      )}

      <TabBar />
      <Onboarding />
    </div>
  );
}
