import Link from "next/link";
import { ArrowRightIcon } from "../icons";

/** A page/section heading with an optional "see all" link. */
export function SectionHeader({
  title,
  kicker,
  href,
  hrefLabel = "See all",
}: {
  title: string;
  kicker?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {kicker && (
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            {kicker}
          </p>
        )}
        <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent-text transition active:opacity-70"
        >
          {hrefLabel}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
