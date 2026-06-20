"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { ArrowRightIcon } from "../icons";
import { BroadcastIcon, MentorIcon, PresentationIcon, TeamBuildIcon } from "../icons";

type Feature = {
  href: string;
  label: string;
  desc: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: string;
};

const FEATURES: Feature[] = [
  {
    href: "/pulse",
    label: "Cue Pulse",
    desc: "Live updates",
    Icon: BroadcastIcon,
    tone: "from-cyan-400/20 text-cyan-200 ring-cyan-300/25",
  },
  {
    href: "/demo",
    label: "Demo Coach",
    desc: "Pitch & submit",
    Icon: PresentationIcon,
    tone: "from-accent/25 text-accent-text ring-accent/30",
  },
  {
    href: "/mentors",
    label: "Mentors",
    desc: "Book office hours",
    Icon: MentorIcon,
    tone: "from-violet-400/20 text-violet-200 ring-violet-300/25",
  },
  {
    href: "/teams",
    label: "Teams",
    desc: "Find & build log",
    Icon: TeamBuildIcon,
    tone: "from-amber-300/20 text-amber-200 ring-amber-300/25",
  },
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
        {FEATURES.map(({ href, label, desc, Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className="card group relative overflow-hidden p-4 transition hover:border-line/80 active:scale-[0.98]"
          >
            <div
              className={cn(
                "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[radial-gradient(circle,var(--tw-gradient-from),transparent_70%)] to-transparent opacity-80 blur-xl",
                tone,
              )}
              aria-hidden
            />
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br to-white/[0.03] ring-1 ring-inset",
                tone,
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 font-display text-[15px] font-bold leading-none tracking-tight">
              {label}
            </p>
            <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-muted">
              <span>{desc}</span>
              <ArrowRightIcon className="h-3 w-3 text-faint transition group-hover:translate-x-0.5 group-active:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
