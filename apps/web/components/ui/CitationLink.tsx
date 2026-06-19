import { cn } from "@/lib/cn";
import { ExternalIcon } from "../icons";

/** Turns a URL into a readable domain label. */
function hostLabel(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h;
  } catch {
    return "source";
  }
}

/**
 * A small source link — the app cites where information comes from (RAG/agent
 * rule: never fabricate, always show sources). Renders as a subtle chip.
 */
export function CitationLink({
  url,
  label,
  className,
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5",
        "text-[11px] font-medium text-muted ring-1 ring-inset ring-line",
        "transition hover:text-foreground hover:ring-accent/30",
        className,
      )}
    >
      <ExternalIcon className="h-3 w-3 shrink-0 opacity-70" />
      <span className="truncate">{label ?? hostLabel(url)}</span>
    </a>
  );
}
