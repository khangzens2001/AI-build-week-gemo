"use client";

import type { ReactNode } from "react";

/**
 * A deliberately tiny markdown renderer for chat prose — the model emits light
 * markdown (bold, links, line breaks, simple bullets). We avoid a dependency and
 * render only safe inline constructs. Not a general-purpose parser.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Match **bold**, [label](url), or bare urls.
  const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex walk
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2]) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
          {m[2]}
        </strong>,
      );
    } else if (m[4] && m[5]) {
      nodes.push(
        <a
          key={`${keyPrefix}-l-${i}`}
          href={m[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-text underline underline-offset-2"
        >
          {m[4]}
        </a>,
      );
    } else if (m[6]) {
      nodes.push(
        <a
          key={`${keyPrefix}-u-${i}`}
          href={m[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-text underline underline-offset-2 break-all"
        >
          {m[6].replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>,
      );
    }
    last = re.lastIndex;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key} className="my-1 ml-1 space-y-1">
        {bullets.map((b, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static markdown lines, never reordered
          <li key={`${key}-${i}`} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{renderInline(b, `${key}-${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet?.[1] !== undefined) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets(`ul-${idx}`);
    if (line.trim() === "") return;
    blocks.push(
      // biome-ignore lint/suspicious/noArrayIndexKey: static markdown lines, never reordered
      <p key={`p-${idx}`} className="leading-relaxed">
        {renderInline(line, `p-${idx}`)}
      </p>,
    );
  });
  flushBullets("ul-end");

  return <div className="space-y-1.5 text-[15px]">{blocks}</div>;
}
