import Image from "next/image";

/**
 * The AABW mascot in a rounded brand-ringed container. Single source for the
 * logo treatment reused across the app bar, the countdown hero and onboarding.
 * Decorative by default (alt="") — it always sits beside text that names it.
 * Pass a `rounded-*` class via `className` to control the corner radius.
 */
export function MascotBadge({
  size = 32,
  className = "rounded-2xl",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-accent/40 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 bg-accent/10" />
      <Image
        src="/brand/mascot.webp"
        alt=""
        width={size}
        height={size}
        priority
        className="relative h-full w-full object-cover"
      />
    </span>
  );
}
