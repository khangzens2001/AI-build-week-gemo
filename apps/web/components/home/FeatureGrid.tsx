"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { MicIcon, PulseIcon, UsersIcon } from "../icons";
import { ArrowRightIcon } from "../icons";

type Feature = {
  href: string;
  label: string;
  desc: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const FEATURES: Feature[] = [
  { href: "/pulse", label: "Cue Pulse", desc: "Live updates", Icon: PulseIcon },
  { href: "/demo", label: "Demo Coach", desc: "Pitch & submit", Icon: MicIcon },
  { href: "/mentors", label: "Mentors", desc: "Book office hours", Icon: UsersIcon },
  { href: "/teams", label: "Teams", desc: "Find & build log", Icon: UsersIcon },
];

/**
 * A compact 2-column grid of feature shortcuts. Since the bottom TabBar is full
 * at five tabs, these glassmorphic cards are the entry points to the secondary
 * surfaces (Pulse, Demo Coach, Mentors, Teams).
 */
export function FeatureGrid() {
  return (
    <section aria-label="More tools">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
        More for builders
      </p>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map(({ href, label, desc, Icon }) => (
          <Link
            key={href}
            href={href}
            className="card group relative overflow-hidden p-4 transition active:scale-[0.98]"
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-[0.1] blur-xl"
              style={{
                background: "radial-gradient(circle, var(--color-accent), transparent 70%)",
              }}
              aria-hidden
            />
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 font-display text-[15px] font-bold leading-none">{label}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted">
              <span>{desc}</span>
              <ArrowRightIcon className="h-3 w-3 text-faint transition group-active:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
