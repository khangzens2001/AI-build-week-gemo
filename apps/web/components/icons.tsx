import type { SVGProps } from "react";

/**
 * A small, consistent line-icon set drawn at 24×24 on a 1.75 stroke. Inline SVG
 * (no dependency) so we control weight + currentColor everywhere. Each icon
 * forwards props so callers can size/colour/aria-label them.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  const label = props["aria-label"];
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : "true"}
      {...props}
    >
      {label ? <title>{label}</title> : null}
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Base>
);

export const ChatIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5h16v11H8l-4 3.5V5Z" />
    <path d="M8.5 9.5h7M8.5 12.5h4" />
  </Base>
);

export const CalendarIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="3" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Base>
);

export const MapIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
    <path d="M9 4v14M15 6v14" />
  </Base>
);

export const GiftIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="9" width="17" height="5" rx="1.5" />
    <path d="M5 14v6.5h14V14M12 9v11.5" />
    <path d="M12 9S10.5 4.5 8 5c-2 .4-1.5 4 4 4ZM12 9s1.5-4.5 4-4c2 .4 1.5 4-4 4Z" />
  </Base>
);

export const PinIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Base>
);

export const ClockIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const BellIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Base>
);

export const SendIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12 20 4l-5 16-4-7-7-1Z" />
  </Base>
);

export const SparkIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M12 8.5 13.4 11l2.6 1-2.6 1L12 15.5 10.6 13 8 12l2.6-1L12 8.5Z" />
  </Base>
);

export const ExternalIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 5h5v5M19 5l-8 8" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Base>
);

export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 12.5 9 17l10.5-11" />
  </Base>
);

export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6.5h16M9 6.5V4.5h6v2M6.5 6.5 7.5 20h9l1-13.5" />
    <path d="M10 10.5v6M14 10.5v6" />
  </Base>
);

export const SearchIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

export const UsersIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 19.5a5.5 5.5 0 0 0-2.2-4.4" />
  </Base>
);

export const MicIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </Base>
);

export const PulseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12h4l2.5-6 4 13L16.5 12H21" />
  </Base>
);

export const RocketIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 4c3.5 0 6 2.5 6 6 0 4-3.5 7-7.5 9L11 17l-3-3c2-4 5-7.5 9-7.5Z" />
    <circle cx="14.5" cy="9.5" r="1.5" />
    <path d="M8 14c-2 0-3 1-3.5 3.5C7 17 8 16 8 14ZM10 16c0 2-1 3-3.5 3.5C7 17 8 16 10 16Z" />
  </Base>
);

export const GoogleIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="Google" {...p}>
    <title>Google</title>
    <path
      fill="#FFC107"
      d="M21.8 10.2H12v3.9h5.6c-.5 2.5-2.6 3.9-5.6 3.9a6 6 0 1 1 0-12c1.5 0 2.9.6 3.9 1.5l2.8-2.8A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.4-.2-2.1Z"
    />
    <path
      fill="#FF3D00"
      d="m3.2 7.3 3.2 2.3A6 6 0 0 1 12 6c1.5 0 2.9.6 3.9 1.5l2.8-2.8A9.9 9.9 0 0 0 12 2 10 10 0 0 0 3.2 7.3Z"
    />
    <path
      fill="#4CAF50"
      d="M12 22c2.6 0 5-1 6.7-2.6l-3.1-2.6c-1 .7-2.2 1.1-3.6 1.1-3 0-5.1-1.4-5.6-3.9l-3.2 2.4A10 10 0 0 0 12 22Z"
    />
    <path
      fill="#1976D2"
      d="M21.8 10.2H12v3.9h5.6c-.3 1.2-1 2.2-1.9 2.9l3.1 2.6c1.8-1.7 2.8-4.2 2.8-7.3 0-.7-.1-1.4-.2-2.1Z"
    />
  </svg>
);
