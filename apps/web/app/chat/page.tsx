"use client";

import { ChatEmpty } from "@/components/chat/ChatEmpty";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function ChatView() {
  const { messages, sendMessage, status } = useChat();
  const params = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentSeed = useRef(false);

  const busy = status === "submitted" || status === "streaming";

  // Prefill + auto-send a question passed via ?q= (deep links from Home/details).
  useEffect(() => {
    const q = params.get("q");
    if (q && !sentSeed.current) {
      sentSeed.current = true;
      sendMessage({ text: q });
    }
  }, [params, sendMessage]);

  // Keep the latest turn in view as content streams in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const showTyping = status === "submitted";
  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 overflow-y-auto px-4"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex min-h-full max-w-md flex-col gap-3 pb-4 pt-2">
          {empty ? (
            <ChatEmpty onPick={(q) => sendMessage({ text: q })} />
          ) : (
            <>
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {showTyping && <TypingIndicator />}
              {status === "error" && (
                <p className="self-start rounded-2xl border border-line bg-surface px-4 py-2.5 text-[13px] text-faint">
                  Something interrupted that reply. Try sending it again.
                </p>
              )}
            </>
          )}
        </div>
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
