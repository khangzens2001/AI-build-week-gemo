"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { CalendarIcon, ChatIcon, GiftIcon, HomeIcon, MapIcon } from "../icons";

type Tab = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const TABS: Tab[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/schedule", label: "Schedule", Icon: CalendarIcon },
  { href: "/chat", label: "Chat", Icon: ChatIcon },
  { href: "/map", label: "Map", Icon: MapIcon },
  { href: "/perks", label: "Perks", Icon: GiftIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Fixed, thumb-reachable bottom navigation with a centered emphasis on Chat. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 pb-safe"
      style={{
        background:
          "linear-gradient(to top, var(--color-bg) 55%, color-mix(in oklab, var(--color-bg) 80%, transparent))",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch justify-around border-t border-line-soft px-2">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const isChat = tab.href === "/chat";
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className="group relative flex flex-1 flex-col items-center justify-center gap-1"
            >
              {/* Fixed-height icon slot keeps every label on the same baseline.
                  The Chat tab's raised circle is absolutely positioned inside it,
                  so it floats above the bar without nudging the label below. */}
              <span className="relative flex h-[26px] w-12 items-center justify-center">
                {isChat ? (
                  <span
                    className={cn(
                      "absolute left-1/2 top-1/2 flex h-11 w-11 items-center justify-center rounded-2xl transition",
                      "-translate-x-1/2 -translate-y-[calc(50%+11px)]",
                      "shadow-lg shadow-black/40 active:scale-90",
                      active
                        ? "bg-accent text-accent-ink glow-accent"
                        : "bg-elevated text-foreground ring-1 ring-line",
                    )}
                  >
                    <tab.Icon className="h-[22px] w-[22px]" />
                  </span>
                ) : (
                  <tab.Icon
                    className={cn(
                      "h-[22px] w-[22px] transition",
                      active ? "text-accent-text" : "text-faint group-active:text-muted",
                    )}
                  />
                )}
              </span>

              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wide transition",
                  active ? "text-accent-text" : "text-faint",
                )}
              >
                {tab.label}
              </span>

              {active && !isChat && (
                <span className="absolute bottom-0 h-1 w-1 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
