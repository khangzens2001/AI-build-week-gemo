"use client";

import { cn } from "@/lib/cn";
import type { UIMessage } from "ai";
import { ChatMarkdown } from "./ChatMarkdown";
import { ToolCard } from "./ToolCard";

/**
 * One chat turn. User turns are right-aligned bubbles; assistant turns render
 * their ordered `parts` — interleaving prose (markdown) with rich tool cards so
 * a card always appears next to the sentence that introduces it.
 */
export function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text)
      .join("");
    return (
      <div className="flex justify-end" style={{ animation: "var(--animate-rise)" }}>
        <div className="max-w-[82%] rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[15px] font-medium text-accent-ink">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" style={{ animation: "var(--animate-rise)" }}>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;
        if (part.type === "text") {
          if (!part.text.trim()) return null;
          return (
            <div
              key={key}
              className={cn(
                "max-w-[88%] self-start rounded-3xl rounded-bl-lg border border-line bg-surface px-4 py-3 text-foreground",
              )}
            >
              <ChatMarkdown text={part.text} />
            </div>
          );
        }
        if (part.type.startsWith("tool-")) {
          return (
            <div key={key} className="max-w-[92%] self-start">
              <ToolCard part={part as never} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
