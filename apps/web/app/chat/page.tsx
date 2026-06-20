"use client";

import { ChatEmpty } from "@/components/chat/ChatEmpty";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ArrowDownIcon } from "@/components/icons";
import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

function ChatView() {
  const { messages, sendMessage, status, regenerate } = useChat();
  const params = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentSeed = useRef(false);
  const [atBottom, setAtBottom] = useState(true);

  const busy = status === "submitted" || status === "streaming";

  // Prefill + auto-send a question passed via ?q= (deep links from Home/details).
  useEffect(() => {
    const q = params.get("q");
    if (q && !sentSeed.current) {
      sentSeed.current = true;
      sendMessage({ text: q });
    }
  }, [params, sendMessage]);

  // Track whether the user is parked at the bottom (within a small threshold),
  // so streaming never yanks them away from history they've scrolled up to read.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 96);
  }, []);

  // Follow the stream only when already at the bottom. Instant (no smooth) so
  // queued animations don't pile up while tokens arrive.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run as content/status changes
  useEffect(() => {
    if (atBottom) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status, atBottom]);

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const showTyping = status === "submitted";
  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* relative wrapper so the "↓ Latest" button anchors to the scroll
          region's bottom (= composer top), never over the composer. */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain px-4"
          role="log"
          aria-label="Conversation"
        >
          <div className="mx-auto flex min-h-full max-w-md flex-col gap-3 pb-4 pt-2">
            {empty ? (
              <ChatEmpty onPick={(q) => sendMessage({ text: q })} />
            ) : (
              <>
                {messages.map((m, i) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    isStreaming={
                      status === "streaming" && i === messages.length - 1 && m.role === "assistant"
                    }
                  />
                ))}
                {showTyping && <TypingIndicator />}
                {status === "error" && (
                  <div className="flex items-center gap-3 self-start rounded-2xl border border-line bg-surface px-4 py-2.5 text-[13px] text-faint">
                    <span>Something interrupted that reply.</span>
                    <button
                      type="button"
                      onClick={() => regenerate()}
                      className="font-semibold text-accent-text underline-offset-2 hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Jump-to-latest — only when scrolled up with content. Anchored to the
            scroll region's bottom (this wrapper), so it sits above the composer. */}
        {!atBottom && !empty && (
          <button
            type="button"
            onClick={jumpToLatest}
            aria-label="Scroll to latest"
            className="absolute inset-x-0 bottom-3 z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-line bg-elevated text-foreground shadow-lg shadow-black/40 transition active:scale-90"
          >
            <ArrowDownIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <ChatInput onSend={(text) => sendMessage({ text })} disabled={busy} />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <ChatView />
    </Suspense>
  );
}
