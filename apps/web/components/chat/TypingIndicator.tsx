"use client";

/** Three-dot "Cue is thinking" bubble shown while a response streams in. */
export function TypingIndicator() {
  return (
    <div className="flex self-start" style={{ animation: "fade-in 0.2s ease both" }}>
      <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg border border-line bg-surface px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-muted"
            style={{
              animation: "blink 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.18}s`,
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
}
