"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";
import { SendIcon } from "../icons";

/**
 * Pinned chat composer. Auto-grows up to a few lines, sends on Enter (Shift+Enter
 * for newline), and disables while a response is streaming.
 *
 * Bottom spacing + keyboard lift are owned by the chat `<main>` (it reserves the
 * TabBar/safe area and the iOS keyboard inset), so this only adds a small inner
 * gap — no safe-area padding or transform here.
 */
export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resize when value changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="border-t border-line-soft bg-bg/80 px-3 pb-2.5 pt-2.5 backdrop-blur">
      <div className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-1.5 pl-4">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about sessions, perks, directions…"
          aria-label="Message Cue"
          className="no-scrollbar max-h-[120px] flex-1 resize-none bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || value.trim() === ""}
          aria-label="Send message"
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-90",
            value.trim() === "" || disabled
              ? "bg-surface-2 text-faint"
              : "bg-accent text-accent-ink",
          )}
        >
          <SendIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
