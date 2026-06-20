"use client";

import { cn } from "@/lib/cn";
import { useCallback, useEffect, useRef, useState } from "react";
import { MicIcon, SendIcon } from "../icons";

/**
 * Pinned chat composer. Auto-grows up to a few lines, sends on Enter (Shift+Enter
 * for newline), and disables while a response is streaming.
 *
 * Bottom spacing + keyboard lift are owned by the chat `<main>` (it reserves the
 * TabBar/safe area and the iOS keyboard inset), so this only adds a small inner
 * gap — no safe-area padding or transform here.
 */

/* ---- Minimal Web Speech API types (not in the DOM lib) -------------------- */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Pick the dictation locale from the browser, defaulting to en-US (vi → vi-VN). */
function dictationLocale(): string {
  if (typeof navigator === "undefined") return "en-US";
  const lang = navigator.language?.toLowerCase() ?? "";
  if (lang.startsWith("vi")) return "vi-VN";
  return "en-US";
}

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  // null = not yet detected; false = unsupported (hide); true = supported.
  const [speechSupported, setSpeechSupported] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Text already committed before this dictation pass, so interim results are
  // appended to (not overwriting) what the user had typed.
  const baseValueRef = useRef("");
  // Mirror of `value` for use inside recognition callbacks (which capture a
  // stale `value` from the closure they were created in).
  const valueRef = useRef("");
  valueRef.current = value;
  // True only while the user wants to keep dictating. The browser ends a
  // recognition session on every speech pause (even with continuous=true on
  // some engines); we use this to auto-restart instead of stopping, so the mic
  // stays "on" until the user taps it off (or sends).
  const wantListeningRef = useRef(false);

  // Feature-detect once on mount (client-only).
  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resize when value changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  // Tear down any live recognition on unmount.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    onSend(text);
    setValue("");
  };

  const stopListening = useCallback(() => {
    // User-initiated stop: don't let onend auto-restart.
    wantListeningRef.current = false;
    setListening(false);
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    wantListeningRef.current = true;

    const recognition = new Ctor();
    recognition.lang = dictationLocale();
    // continuous keeps the engine open through short pauses where supported.
    recognition.continuous = true;
    recognition.interimResults = true;
    baseValueRef.current = valueRef.current ? `${valueRef.current.replace(/\s+$/, "")} ` : "";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result) transcript += result[0]?.transcript ?? "";
      }
      setValue(baseValueRef.current + transcript);
    };
    recognition.onend = () => {
      // The engine ends a session on every speech pause. If the user still wants
      // to dictate, restart so the mic visibly stays "on" until they tap it off
      // (or send). Carry whatever's been dictated into the new base so a restart
      // appends rather than overwrites.
      if (wantListeningRef.current) {
        baseValueRef.current = valueRef.current ? `${valueRef.current.replace(/\s+$/, "")} ` : "";
        try {
          recognition.start();
          return;
        } catch {
          // fallthrough to idle
        }
      }
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      // "no-speech"/"aborted" fire often; only drop out if the user stopped.
      if (!wantListeningRef.current) {
        setListening(false);
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if already running — ignore.
      setListening(false);
    }
  }, []);

  const toggleMic = () => {
    if (disabled) return;
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const isEmpty = value.trim() === "";

  return (
    <div className="border-t border-line-soft bg-bg/80 px-3 pb-2.5 pt-2.5 backdrop-blur">
      <div
        className={cn(
          "flex items-end gap-2 rounded-3xl border bg-surface p-1.5 pl-4 transition",
          "focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/40",
          listening ? "border-accent/50" : "border-line",
        )}
      >
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
          placeholder={listening ? "Listening…" : "Ask about sessions, perks, directions…"}
          aria-label="Message Cue"
          className="composer-field no-scrollbar max-h-[120px] flex-1 resize-none self-center bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-faint"
        />

        {speechSupported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={disabled}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            aria-pressed={listening}
            className={cn(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-90",
              listening
                ? "bg-accent text-accent-ink"
                : "text-faint hover:text-foreground disabled:opacity-50",
            )}
          >
            {listening && (
              <>
                {/* Expanding ping ring — clearly signals the mic is live. */}
                <span
                  className="absolute inset-0 rounded-2xl ring-2 ring-accent"
                  style={{ animation: "var(--animate-pulse-ring)" }}
                  aria-hidden
                />
                {/* Soft breathing glow behind the icon. */}
                <span
                  className="absolute inset-0 rounded-2xl bg-accent/30"
                  style={{ animation: "var(--animate-blink)" }}
                  aria-hidden
                />
              </>
            )}
            <MicIcon className="relative h-[18px] w-[18px]" />
          </button>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={disabled || isEmpty}
          aria-label="Send message"
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-90",
            isEmpty || disabled ? "bg-surface-2 text-faint" : "bg-accent text-accent-ink",
          )}
        >
          <SendIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
